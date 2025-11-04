import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isValidCourseCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  const trimmed = code.trim();
  
  if (!trimmed) return false;
  
  // Only skip truly generic placeholders (without program prefix)
  // Examples to skip: "TRACK COURSE", "ELECTIVE", "H TRACK COURSE"
  // Examples to KEEP: "CHNS-H TRACK COURSE", "ARTS ELECTIVE 1", "IE 3"
  const genericPlaceholders = /^(TRACK\s+COURSE|[A-Z]\s+TRACK|ELECTIVE|COURSE\s+ELECTIVE)$/i;
  if (genericPlaceholders.test(trimmed)) {
    return false;
  }
  
  // Must not have excessive spaces
  if (/\s{2,}/.test(trimmed)) {
    return false;
  }
  
  // Valid formats: DEPT NN, DEPT NN.NN, DEPT NNA, DEPT_ELECN, DEPT-TRACK COURSE
  // Allow dashes, spaces, underscores in course codes
  const validPattern = /^[A-Z]+[\s_-]+[\dA-Z.\s-]+$/;
  
  return validPattern.test(trimmed);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. AUTH CHECK (using anon client)
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check admin role
    const { data: roles } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    
    if (!roles?.some(r => r.role === 'admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. PARSE & VALIDATE PAYLOAD
    const payload = await req.json()
    const validation = validatePayload(payload)
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. COMPUTE IDEMPOTENCY KEY
    const idempotencyKey = await computeIdempotencyKey(payload)

    // 4. CHECK FOR EXISTING JOB WITH SAME KEY
    const { data: existingJob } = await anonClient
      .from('import_jobs')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingJob) {
      return new Response(JSON.stringify({
        job_id: existingJob.id,
        status: existingJob.status,
        message: 'Import already in progress or completed',
        existing: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4.5. CHECK FOR DUPLICATE CURRICULUM VERSION (EARLY DETECTION)
    if (payload.existing_program_id) {
      let duplicateQuery = anonClient
        .from('curriculum_versions')
        .select('id, version_label, version_seq')
        .eq('program_id', payload.existing_program_id)
        .eq('version_year', payload.version_year)
        .eq('version_sem', payload.version_sem)
        .eq('version_seq', payload.version_seq || 1);
      
      // Handle three cases for track matching
      if (payload.existing_track_id) {
        // Case 1: Existing track - must match exactly
        duplicateQuery = duplicateQuery.eq('track_id', payload.existing_track_id);
      } else if (payload.track_suffix) {
        // Case 2: New track - cannot be duplicate (use impossible UUID)
        duplicateQuery = duplicateQuery.eq('track_id', '00000000-0000-0000-0000-000000000000');
      } else {
        // Case 3: No track - must also have NULL track_id
        duplicateQuery = duplicateQuery.is('track_id', null);
      }
      
      const { data: existingVersion } = await duplicateQuery.maybeSingle();
      
      if (existingVersion) {
        return new Response(
          JSON.stringify({
            error: 'DUPLICATE_CURRICULUM',
            message: `Curriculum version "${existingVersion.version_label}" already exists. Cannot import duplicate.`,
            existing_version_id: existingVersion.id
          }),
          { 
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // 5. CREATE JOB RECORD
    const { data: job, error: jobError } = await anonClient
      .from('import_jobs')
      .insert({
        user_id: user.id,
        status: 'pending',
        idempotency_key: idempotencyKey,
        program_name: payload.program_name,
        program_code: payload.program_code,
        track_code: payload.track_suffix,
        version_label: payload.version_label,
        total_courses: payload.courses?.length || 0,
      })
      .select()
      .single()

    if (jobError) throw jobError

    // 6. RETURN 202 ACCEPTED IMMEDIATELY
    const response = new Response(JSON.stringify({
      job_id: job.id,
      status: 'accepted',
      message: 'Import started. You can safely leave this page.'
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    // 7. PROCESS IN BACKGROUND
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Use waitUntil for background processing with proper error handling
    const backgroundProcess = processImportInBackground(serviceClient, job.id, payload, user.id)
    
    // Add shutdown listener to mark job as failed if function is terminated
    addEventListener('beforeunload', async () => {
      try {
        await serviceClient.from('import_jobs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Function shutdown during processing',
          updated_at: new Date().toISOString()
        }).eq('id', job.id).eq('status', 'processing')
      } catch (err) {
        console.error(`[Job ${job.id}] Failed to update status on shutdown:`, err)
      }
    })
    
    // Wrap in try-catch to ensure errors are logged and job status is updated
    backgroundProcess.catch(async (err) => {
      console.error(`[Job ${job.id}] Background process error:`, err)
      // Ensure job is marked as failed if it hasn't been updated
      try {
        await serviceClient.from('import_jobs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: err.message || 'Unknown error in background process',
          error_details: { stack: err.stack },
          updated_at: new Date().toISOString()
        }).eq('id', job.id).eq('status', 'processing') // Only update if still processing
      } catch (updateErr) {
        console.error(`[Job ${job.id}] Failed to update error status:`, updateErr)
      }
    })

    return response

  } catch (error: any) {
    console.error('Import endpoint error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function validatePayload(payload: any): { valid: boolean; error?: string } {
  if (!payload.program_code?.trim()) {
    return { valid: false, error: 'program_code is required' }
  }
  if (!payload.version_year || !payload.version_sem) {
    return { valid: false, error: 'version_year and version_sem are required' }
  }
  if (!Array.isArray(payload.courses) || payload.courses.length === 0) {
    return { valid: false, error: 'courses array is required and must not be empty' }
  }
  
  for (const course of payload.courses) {
    if (!course.course_code?.trim() || !course.course_title?.trim()) {
      return { valid: false, error: 'Each course must have course_code and course_title' }
    }
    if (typeof course.units !== 'number' || course.units < 0) {
      return { valid: false, error: 'Each course must have valid units' }
    }
  }

  return { valid: true }
}

async function computeIdempotencyKey(payload: any): Promise<string> {
  const normalized = JSON.stringify({
    code: payload.program_code?.trim().toUpperCase(),
    track: payload.track_suffix?.trim().toUpperCase() || null,
    year: payload.version_year,
    sem: payload.version_sem,
    // Note: version_seq removed - duplicate detection based on content only
    courses: payload.courses
      .map((c: any) => c.course_code?.trim().toUpperCase())
      .sort()
  })

  const msgUint8 = new TextEncoder().encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function processImportInBackground(
  serviceClient: any,
  jobId: string,
  payload: any,
  userId: string
) {
  let lastHeartbeat = Date.now()
  
  // Helper to record logs to function_logs
  const recordLog = async (level: 'info' | 'warn' | 'error' | 'log', event_type: string, event_message: string, details?: any) => {
    try {
      await serviceClient.from('function_logs').insert({
        function_name: 'import-curriculum',
        level,
        event_type,
        event_message,
        details,
        user_id: userId
      })
    } catch (_) {}
  }
  
  // Helper to update heartbeat (reduced frequency)
  const heartbeat = async () => {
    const now = Date.now()
    if (now - lastHeartbeat > 60000) { // Every 60 seconds
      await serviceClient.from('import_jobs').update({
        updated_at: new Date().toISOString()
      }).eq('id', jobId)
      lastHeartbeat = now
    }
  }
  
  try {
    console.log(`[Job ${jobId}] Starting background import`)
    await recordLog('info', 'start', `[Job ${jobId}] Curriculum import started`, { 
      jobId, 
      programCode: payload.program_code,
      track: payload.track_suffix,
      version: `${payload.version_year}-${payload.version_sem}-${payload.version_seq || 1}`
    })

    await serviceClient.from('import_jobs').update({
      status: 'processing',
      started_at: new Date().toISOString(),
      progress: 0
    }).eq('id', jobId)

    // Compute lock key
    const lockKey = computeLockKey(
      payload.existing_program_id || payload.program_code,
      payload.existing_track_id || payload.track_suffix,
      payload.version_year,
      payload.version_sem,
      payload.version_seq || 1
    )

    console.log(`[Job ${jobId}] Lock key: ${lockKey}`)

    // Check for duplicate curriculum version (improved check)
    let programId = payload.existing_program_id
    let trackId = payload.existing_track_id
    
    if (programId) {
      // Check for curriculum version with matching program/track/year/sem/seq
      let duplicateQuery = serviceClient
        .from('curriculum_versions')
        .select('id, version_label')
        .eq('program_id', programId)
        .eq('version_year', payload.version_year)
        .eq('version_sem', payload.version_sem)
        .eq('version_seq', payload.version_seq || 1);
      
      // Handle three cases for track matching
      if (trackId) {
        // Case 1: Existing track
        duplicateQuery = duplicateQuery.eq('track_id', trackId);
      } else if (payload.track_suffix) {
        // Case 2: New track - cannot be duplicate
        duplicateQuery = duplicateQuery.eq('track_id', '00000000-0000-0000-0000-000000000000');
      } else {
        // Case 3: No track
        duplicateQuery = duplicateQuery.is('track_id', null);
      }
      
      const { data: existingVersion } = await duplicateQuery.maybeSingle();

      if (existingVersion) {
        // Return 409 Conflict status for duplicates
        await serviceClient.from('import_jobs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: `Duplicate curriculum version already exists for this program, track, year, and semester: ${existingVersion.version_label}`,
          error_details: { duplicate_version_id: existingVersion.id, status_code: 409 }
        }).eq('id', jobId)
        
        throw new Error(`DUPLICATE_CURRICULUM: ${existingVersion.version_label}`)
      }
    }

    await heartbeat()
    await updateJobProgress(serviceClient, jobId, 10)

    // STEP 1: UPSERT PROGRAM
    if (!programId) {
      const { data: prog, error: progError } = await serviceClient
        .from('programs')
        .upsert({
          school_id: payload.school_id,
          code: payload.program_code,
          name: payload.program_name,
          total_units: payload.total_units || 120
        }, { onConflict: 'code' })
        .select()
        .single()

      if (progError) throw progError
      programId = prog.id
      console.log(`[Job ${jobId}] Program upserted: ${programId}`)
    }

    await heartbeat()
    await updateJobProgress(serviceClient, jobId, 20)

    // STEP 2: UPSERT TRACK
    if (payload.track_suffix && !trackId) {
      const { data: track, error: trackError } = await serviceClient
        .from('program_tracks')
        .upsert({
          program_id: programId,
          track_code: payload.track_suffix,
          track_name: payload.track_name || payload.track_suffix
        }, { onConflict: 'program_id,track_code' })
        .select()
        .single()

      if (trackError) throw trackError
      trackId = track.id
      console.log(`[Job ${jobId}] Track upserted:`, {
        track_id: trackId,
        track_code: payload.track_suffix,
        track_name: payload.track_name || payload.track_suffix,
        program_id: programId
      })
    }

    await heartbeat()
    await updateJobProgress(serviceClient, jobId, 30)

    // STEP 3: CREATE CURRICULUM VERSION
    const { data: version, error: versionError } = await serviceClient
      .from('curriculum_versions')
      .insert({
        program_id: programId,
        track_id: trackId,
        version_label: payload.version_label,
        version_year: payload.version_year,
        version_sem: payload.version_sem,
        version_seq: payload.version_seq || 1,
        is_active: true
      })
      .select()
      .single()

    if (versionError) throw versionError
    const versionId = version.id
    console.log(`[Job ${jobId}] Version created: ${versionId}`)
    await recordLog('info', 'version_created', `[Job ${jobId}] Version created: ${versionId}`, { versionId })

    await updateJobProgress(serviceClient, jobId, 40)

    // STEP 4: BATCH UPSERT COURSES WITH SMART SCHOOL ASSIGNMENT
    const courseMap = new Map()
    const batchSize = 50
    let coursesProcessed = 0
    const seenCodes = new Set<string>() // Track codes for course table deduplication
    const allValidCodes = new Set<string>() // Track all valid codes (including duplicates) for courseMap
    const coursesToUpdateSchoolStatus = new Set<string>() // Batch school status updates
    
    for (let i = 0; i < payload.courses.length; i += batchSize) {
      const batch = payload.courses.slice(i, i + batchSize)
      
      // Separate validation from deduplication
      const validCourses = []
      const allBatchCodes = []
      
      for (const c of batch) {
        const code = c.course_code?.trim().toUpperCase()
        if (!code) {
          coursesProcessed++
          continue
        }
        
        // Validate course code
        if (!isValidCourseCode(c.course_code)) {
          console.log(`[Job ${jobId}] ⚠️ Skipping invalid course code: "${c.course_code}" (${c.course_title})`)
          coursesProcessed++
          continue
        }
        
        // Track ALL valid course codes (for courseMap lookup later)
        allValidCodes.add(code)
        allBatchCodes.push(code)
        
        // Only add to insert batch if not already seen (for course table deduplication)
        if (!seenCodes.has(code)) {
          validCourses.push(c)
          seenCodes.add(code)
        } else {
          console.log(`[Job ${jobId}] ℹ️ Course "${code}" seen before, will reuse existing ID for rules`)
          coursesProcessed++
        }
      }
      
      if (validCourses.length === 0 && allBatchCodes.length === 0) continue
      
      // Phase 1: Batch check all unique courses in this batch
      const uniqueCodesInBatch = Array.from(new Set(allBatchCodes))
      const { data: existingCourses } = await serviceClient
        .from('courses')
        .select('id, course_code, is_university_wide')
        .in('course_code', uniqueCodesInBatch)
      
      const existingMap = new Map(existingCourses?.map((c: any) => [c.course_code, c]) || [])
      
      // Phase 2: Separate existing and new courses
      const newCoursesToInsert = []
      const newCourseCodes: string[] = []
      
      for (const course of validCourses) {
        const existingCourse = existingMap.get(course.course_code)
        
        if (existingCourse) {
          // Existing course - add to map
          courseMap.set(course.course_code, (existingCourse as any).id)
        } else {
          // New course - collect for batch insert (dedupe again by code)
          if (!newCourseCodes.includes(course.course_code)) {
            newCourseCodes.push(course.course_code)
            newCoursesToInsert.push({
              course_code: course.course_code,
              course_title: course.course_title,
              units: course.units,
              school_id: payload.school_id,
              is_university_wide: false,
              prereq_expr: course.prerequisites?.join(' AND ') || null,
              category_tags: course.category ? [course.category] : null
            })
          }
        }
      }
      
      // Phase 3: Batch insert new courses with conflict handling and RETURNING
      if (newCoursesToInsert.length > 0) {
        // Insert with onConflict to gracefully handle race conditions, use RETURNING to get IDs
        const { data: insertedCourses, error: insertError } = await serviceClient
          .from('courses')
          .upsert(newCoursesToInsert, {
            onConflict: 'course_code',
            ignoreDuplicates: true
          })
          .select('id, course_code, is_university_wide')
        
        if (insertError) {
          console.error(`[Job ${jobId}] ⚠️ Error inserting batch:`, insertError)
        } else {
          // Add newly inserted courses to courseMap and track for school status update
          insertedCourses?.forEach((course: any) => {
            courseMap.set(course.course_code, course.id)
            if (!course.is_university_wide) {
              coursesToUpdateSchoolStatus.add(course.course_code)
            }
          })
        }
      }
      
      // Phase 4: Update courseMap with existing courses and track for school status
      existingMap.forEach((course, code) => {
        if (!courseMap.has(code as string)) {
          courseMap.set(code as string, (course as any).id)
        }
        if (!(course as any).is_university_wide) {
          coursesToUpdateSchoolStatus.add(code as string)
        }
      })
      
      // Phase 4: Update school status for all courses in batch (removed old sequential calls)
      // Now handled by batch update after all courses are processed
      
      // Update progress after each batch with heartbeat
      await heartbeat()
      coursesProcessed += validCourses.length
      const courseProgress = 40 + Math.floor((coursesProcessed / payload.courses.length) * 30)
      
      await serviceClient
        .from('import_jobs')
        .update({
          courses_processed: coursesProcessed,
          progress: courseProgress
        })
        .eq('id', jobId)
    }

    console.log(`[Job ${jobId}] ${courseMap.size} courses processed`)
    await recordLog('info', 'courses_processed', `[Job ${jobId}] ${courseMap.size} courses processed`)
    await heartbeat()
    await updateJobProgress(serviceClient, jobId, 70)

    // STEP 5: CREATE REQUIREMENT GROUPS & RULES
    const termGroups = groupCoursesByTerm(payload.courses)
    const categoryGroups = groupCoursesByCategory(payload.courses)
    const allGroups = [...termGroups, ...categoryGroups]

    for (const [idx, group] of allGroups.entries()) {
      const { data: reqGroup, error: groupError } = await serviceClient
        .from('requirement_groups')
        .insert({
          curriculum_id: versionId,
          name: group.name,
          group_type: group.group_type,
          display_order: idx,
          min_units: group.min_units,
          priority: group.priority || 100
        })
        .select()
        .single()

      if (groupError) throw groupError

      // Phase 4: Batch insert rules for this group
      const rulesToInsert = []
      for (const courseCode of group.courses) {
        const courseId = courseMap.get(courseCode)
        if (courseId) {
          rulesToInsert.push({
            req_group_id: reqGroup.id,
            rule_type: 'by_course',
            course_ids: [courseId]
          })
        }
      }
      
      if (rulesToInsert.length > 0) {
        await serviceClient
          .from('requirement_rules')
          .insert(rulesToInsert)
      }
    }

    console.log(`[Job ${jobId}] ${allGroups.length} requirement groups created`)
    await heartbeat()
    await updateJobProgress(serviceClient, jobId, 90)

    // STEP 6: UPDATE SCHOOL STATUS FOR COURSES (mark university-wide if used by 2+ schools)
    console.log(`[Job ${jobId}] Updating school status for ${coursesToUpdateSchoolStatus.size} courses`)
    
    await batchUpdateCourseSchoolStatus(serviceClient, Array.from(coursesToUpdateSchoolStatus), payload.school_id)
    
    await heartbeat()

    // Update job as completed
    await serviceClient.from('import_jobs').update({
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString(),
      created_program_id: programId,
      created_track_id: trackId,
      created_version_id: versionId,
      courses_processed: payload.courses.length
    }).eq('id', jobId)

    console.log(`[Job ${jobId}] Import completed successfully`)
    await recordLog('info', 'completed', `[Job ${jobId}] Curriculum import completed`, {
      programCode: payload.program_code,
      track: payload.track_suffix,
      version: `${payload.version_year}-${payload.version_sem}-${payload.version_seq || 1}`,
      coursesProcessed: payload.courses.length,
      requirementGroups: allGroups.length,
      schoolStatusUpdates: coursesToUpdateSchoolStatus.size
    })

  } catch (error: any) {
    console.error(`[Job ${jobId}] Import failed:`, error)
    await recordLog('error', 'error', `[Job ${jobId}] Curriculum import failed`, { 
      error: error.message,
      programCode: payload.program_code,
      track: payload.track_suffix
    })

    // Provide more detailed error messages
    let errorMessage = error.message || 'Unknown error occurred'
    if (error.message?.includes('DUPLICATE_CURRICULUM')) {
      errorMessage = 'This curriculum version already exists'
    } else if (error.message?.includes('duplicate key')) {
      errorMessage = 'Duplicate data detected during import'
    } else if (error.message?.includes('foreign key')) {
      errorMessage = 'Invalid reference to program or track'
    }

    // Rollback: Delete created entities to prevent orphaned data
    let rollbackDetails = {}
    try {
      const jobData = await serviceClient.from('import_jobs').select('created_version_id, created_track_id, created_program_id').eq('id', jobId).single()
      
      if (jobData.data?.created_version_id) {
        await serviceClient.from('curriculum_versions').delete().eq('id', jobData.data.created_version_id)
        rollbackDetails = { ...rollbackDetails, deleted_version: jobData.data.created_version_id }
      }
      
      // Check if track/program should be deleted (if they have no other curriculum versions)
      if (jobData.data?.created_track_id) {
        const { count } = await serviceClient.from('curriculum_versions').select('id', { count: 'exact', head: true }).eq('track_id', jobData.data.created_track_id)
        if ((count || 0) === 0) {
          await serviceClient.from('program_tracks').delete().eq('id', jobData.data.created_track_id)
          rollbackDetails = { ...rollbackDetails, deleted_track: jobData.data.created_track_id }
        }
      }
      
      if (jobData.data?.created_program_id) {
        const { count } = await serviceClient.from('curriculum_versions').select('id', { count: 'exact', head: true }).eq('program_id', jobData.data.created_program_id)
        if ((count || 0) === 0) {
          await serviceClient.from('programs').delete().eq('id', jobData.data.created_program_id)
          rollbackDetails = { ...rollbackDetails, deleted_program: jobData.data.created_program_id }
        }
      }
    } catch (rollbackError: any) {
      console.error(`[Job ${jobId}] Rollback error:`, rollbackError)
      rollbackDetails = { ...rollbackDetails, rollback_error: rollbackError?.message || String(rollbackError) }
    }

    await serviceClient.from('import_jobs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      error_details: { 
        stack: error.stack,
        original_error: error.message,
        rollback: rollbackDetails
      }
    }).eq('id', jobId).eq('status', 'processing') // Only update if still processing
  }
}

async function updateJobProgress(client: any, jobId: string, progress: number) {
  await client.from('import_jobs').update({ progress }).eq('id', jobId)
}

function computeLockKey(programId: string, trackId: string | null, year: number, sem: number, seq: number): number {
  const str = `${programId}|${trackId || 'null'}|${year}|${sem}|${seq}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

function groupCoursesByTerm(courses: any[]) {
  const terms = new Map()
  const ungrouped: any[] = []
  
  for (const course of courses) {
    // Validate term data exists
    if (!course.year_level || !course.semester) {
      console.log(`⚠️ Course missing term data: ${course.course_code} (year: ${course.year_level}, sem: ${course.semester})`)
      ungrouped.push(course)
      continue
    }
    
    const key = `Y${course.year_level} ${course.semester}`
    if (!terms.has(key)) {
      terms.set(key, {
        name: `Year ${course.year_level} - ${course.semester}`,
        group_type: 'term',
        min_units: 0,
        priority: course.year_level * 10 + (course.semester === 'First' ? 1 : 2),
        courses: []
      })
    }
    terms.get(key).courses.push(course.course_code)
    terms.get(key).min_units += course.units
  }
  
  // Add fallback group for ungrouped courses
  if (ungrouped.length > 0) {
    console.log(`ℹ️ Creating 'Unassigned' group for ${ungrouped.length} courses without term data`)
    terms.set('Unassigned', {
      name: 'Unassigned Courses',
      group_type: 'term',
      min_units: ungrouped.reduce((sum, c) => sum + (c.units || 0), 0),
      priority: 999,
      courses: ungrouped.map(c => c.course_code)
    })
  }
  
  return Array.from(terms.values())
}

function groupCoursesByCategory(courses: any[]) {
  const categories = new Map()
  for (const course of courses) {
    const key = course.category || 'Uncategorized'
    if (!categories.has(key)) {
      categories.set(key, {
        name: key,
        group_type: 'category',
        min_units: 0,
        priority: 200,
        courses: []
      })
    }
    categories.get(key).courses.push(course.course_code)
  }
  return Array.from(categories.values())
}

// Batched version of updateCourseSchoolStatus for performance
async function batchUpdateCourseSchoolStatus(
  client: any,
  courseCodes: string[],
  schoolId: string
) {
  if (courseCodes.length === 0) return
  
  try {
    // Phase 1: Batch fetch all courses
    const { data: courses } = await client
      .from('courses')
      .select('id, course_code, is_university_wide')
      .in('course_code', courseCodes)
    
    if (!courses || courses.length === 0) return
    
    const courseIds = courses.map((c: any) => c.id)
    
    // Phase 2: Batch upsert usage records
    const usageRecords = courses.map((course: any) => ({
      course_id: course.id,
      school_id: schoolId,
      curriculum_count: 1
    }))
    
    await client
      .from('course_school_usage')
      .upsert(usageRecords, {
        onConflict: 'course_id,school_id',
        ignoreDuplicates: false
      })
    
    // Phase 3: Batch count schools per course
    const { data: usageCounts } = await client
      .from('course_school_usage')
      .select('course_id, school_id')
      .in('course_id', courseIds)
    
    // Group by course_id to count distinct schools
    const schoolCountMap = new Map<string, number>()
    usageCounts?.forEach((usage: any) => {
      const count = schoolCountMap.get(usage.course_id) || 0
      schoolCountMap.set(usage.course_id, count + 1)
    })
    
    // Phase 4: Batch update university-wide status for courses used by 2+ schools
    const coursesToMarkUniversityWide = Array.from(schoolCountMap.entries())
      .filter(([_, count]) => count >= 2)
      .map(([courseId, _]) => courseId)
    
    if (coursesToMarkUniversityWide.length > 0) {
      console.log(`📘 Marking ${coursesToMarkUniversityWide.length} courses as university-wide`)
      await client
        .from('courses')
        .update({ is_university_wide: true })
        .in('id', coursesToMarkUniversityWide)
        .eq('is_university_wide', false)
    }
  } catch (error) {
    console.error('Error in batch updateCourseSchoolStatus:', error)
    // Don't throw - school status is not critical for import success
  }
}
