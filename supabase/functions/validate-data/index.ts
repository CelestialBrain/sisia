import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ValidationIssue {
  type: string;
  severity: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    // Initialize log buffer
    const logBuffer: string[] = [];
    const startTime = Date.now();
    logBuffer.push('======== DATA VALIDATION ========');
    logBuffer.push(`Timestamp: ${new Date().toISOString()}`);
    logBuffer.push(`Requested by: ${user.email}`);
    logBuffer.push('');

    const issues: ValidationIssue[] = [];

    // 1. Programs without curriculum versions
    logBuffer.push('=== CHECKING PROGRAMS WITHOUT VERSIONS ===');
    const { data: cvData } = await supabase.from('curriculum_versions').select('program_id');
    const programIds = cvData?.map((v: any) => v.program_id) || [];
    logBuffer.push(`Programs with versions: ${programIds.length}`);
    
    const { data: programsWithoutVersions } = await supabase
      .from('programs')
      .select('id, code, name')
      .not('id', 'in', programIds.length > 0 ? `(${programIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)');

    logBuffer.push(`Programs without versions: ${programsWithoutVersions?.length || 0}`);
    for (const p of programsWithoutVersions || []) {
      logBuffer.push(`✗ Program "${p.code}" has NO curriculum versions`);
      issues.push({
        type: 'Program Without Curriculum Version',
        severity: 'error',
        message: `${p.code}: ${p.name} has no curriculum versions defined`
      });
    }
    logBuffer.push('=== PROGRAMS CHECK COMPLETE ===');
    logBuffer.push('');

    // 2. Curriculum versions without groups
    logBuffer.push('=== CHECKING VERSIONS WITHOUT GROUPS ===');
    const { data: allVersions } = await supabase
      .from('curriculum_versions')
      .select('id, version_label, programs(code)');
    
    logBuffer.push(`Total curriculum versions: ${allVersions?.length || 0}`);

    for (const version of allVersions || []) {
      const { data: groups } = await supabase
        .from('requirement_groups')
        .select('id')
        .eq('curriculum_id', version.id);

      const programCode = (version.programs as any)?.code || 'Unknown';

      if (!groups || groups.length === 0) {
        logBuffer.push(`✗ Version "${programCode} ${version.version_label}" has NO requirement groups`);
        issues.push({
          type: 'Version Without Requirement Groups',
          severity: 'error',
          message: `${programCode} ${version.version_label}: Has no requirement groups`
        });
      } else {
        logBuffer.push(`✓ Version "${programCode} ${version.version_label}" has ${groups.length} groups`);
      }
    }
    logBuffer.push('=== VERSIONS CHECK COMPLETE ===');
    logBuffer.push('');

    // 3. Orphaned courses
    logBuffer.push('=== ORPHANED COURSES CHECK ===');
    const { data: allCourses } = await supabase.from('courses').select('id, course_code, course_title');
    const { data: rules } = await supabase.from('requirement_rules').select('course_ids');
    
    logBuffer.push(`Total courses in database: ${allCourses?.length}`);
    logBuffer.push(`Total requirement rules: ${rules?.length}`);
    
    const usedCourseIds = new Set(rules?.flatMap((r: any) => r.course_ids || []) || []);
    logBuffer.push(`Unique course IDs referenced in rules: ${usedCourseIds.size}`);
    
    const orphaned = allCourses?.filter(c => !usedCourseIds.has(c.id)) || [];
    logBuffer.push(`Initial orphan candidates: ${orphaned.length}`);
    
    // Double-check each "orphaned" course
    let trueOrphans = 0;
    for (const course of orphaned) {
      const { data: directCheck, error: checkError } = await supabase
        .from('requirement_rules')
        .select('id, req_group_id, rule_type')
        .contains('course_ids', [course.id]);
      
      if (checkError) {
        logBuffer.push(`Error checking "${course.course_code}": ${checkError.message}`);
        continue;
      }
      
      if (!directCheck || directCheck.length === 0) {
        trueOrphans++;
        logBuffer.push(`✗ "${course.course_code}" is TRULY ORPHANED (not in any rule)`);
        issues.push({
          type: 'Orphaned Course',
          severity: 'warning',
          message: `${course.course_code} is not used in any curriculum`
        });
      }
    }
    logBuffer.push(`True orphans found: ${trueOrphans}`);
    logBuffer.push('=== ORPHANED COURSES CHECK COMPLETE ===');
    logBuffer.push('');

    // 4. Invalid prerequisite references
    logBuffer.push('=== PREREQUISITE VALIDATION ===');
    const { data: courses } = await supabase
      .from('courses')
      .select('course_code, prereq_expr');
    
    const courseCodes = new Set(courses?.map((c: any) => c.course_code) || []);
    logBuffer.push(`Validating prerequisites for ${courses?.length} courses`);
    logBuffer.push(`Valid course codes available: ${courseCodes.size}`);
    
    let prereqIssuesFound = 0;
    for (const course of courses || []) {
      if (!course.prereq_expr) continue;
      
      const referencedCourses = course.prereq_expr.match(/[A-Z]{2,5}-?\d{2,4}/gi) || [];
      
      for (const ref of referencedCourses) {
        const normalized = ref.replace(/\s/g, '').toUpperCase();
        if (!courseCodes.has(normalized)) {
          prereqIssuesFound++;
          logBuffer.push(`✗ INVALID PREREQ: "${course.course_code}" references non-existent "${normalized}"`);
          issues.push({
            type: 'Invalid Prerequisite Reference',
            severity: 'error',
            message: `${course.course_code} references non-existent prerequisite: ${normalized}`
          });
        }
      }
    }
    
    logBuffer.push(`Prerequisite issues found: ${prereqIssuesFound}`);
    logBuffer.push('=== PREREQUISITE VALIDATION COMPLETE ===');
    logBuffer.push('');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    logBuffer.push('======== VALIDATION COMPLETE ========');
    logBuffer.push(`Total issues found: ${issues.length}`);
    logBuffer.push(`- Errors: ${errors}`);
    logBuffer.push(`- Warnings: ${warnings}`);
    logBuffer.push(`Duration: ${duration}s`);
    logBuffer.push('====================================');

    // Create single consolidated log entry
    await logMessage(
      issues.length > 0 ? 'warn' : 'info',
      'validate-data',
      `Data validation completed: ${issues.length} issue${issues.length !== 1 ? 's' : ''} found (${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''})`,
      {
        summary: {
          totalIssues: issues.length,
          errors,
          warnings,
          duration: `${duration}s`,
          timestamp: new Date().toISOString(),
          requestedBy: user.email
        },
        fullLog: logBuffer.join('\n')
      }
    );

    return new Response(
      JSON.stringify({ issues }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    await logMessage('error', 'validate-data', `Validation failed: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message === 'Unauthorized' || error.message === 'Admin access required' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function logMessage(level: string, functionName: string, message: string, details?: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('function_logs').insert({
      function_name: functionName,
      level,
      event_message: message,
      event_type: 'Log',
      details
    });

    // Also log to console for edge function logs
    console.log(`[${level.toUpperCase()}] ${message}`);
  } catch (e) {
    console.error('Failed to log message:', e);
  }
}
