import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// AISIS Configuration
const AISIS_BASE_URL = "https://aisis.ateneo.edu/j_aisis";
const RATE_LIMIT_DELAY = 500; // 500ms between batches
const REQUEST_TIMEOUT = 30000; // 30 second timeout per request
const MAX_RETRIES = 3;
const CONCURRENT_BATCH_SIZE = 5; // Process 5 programs at once
const DEPARTMENT_BATCH_SIZE = 3; // Process schedule departments concurrently

interface ScrapeRequest {
  jobId?: string;
  scrapeSchedules: boolean;
  scrapeCurriculum: boolean;
  scrapeGrades: boolean;
  scrapeMySchedule: boolean;
  scrapeMyProgram: boolean;
  scrapeMyGrades: boolean;
  scrapeHoldOrders: boolean;
  scrapeAccountInfo: boolean;
}

interface AISISSession {
  cookies: string;
  sessionId: string;
}

interface ProgramInfo {
  value: string;
  text: string;
  programCode: string;
  programName: string;
  versionYear: number;
  versionSem: number;
}

// ============= Cookie Management Helper Functions =============

/**
 * Sanitize cookies by removing control characters, non-ASCII chars, and duplicates
 * Enhanced version with additional validation
 */
function sanitizeCookies(cookieString: string): string {
  if (!cookieString) return "";

  // Split into individual cookies
  const cookies = cookieString
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  // Use Map to track cookies by name (keeps last occurrence)
  const cookieMap = new Map<string, string>();

  for (const cookie of cookies) {
    // Remove all control characters (including \r, \n, \t, \0)
    let cleaned = cookie.replace(/[\x00-\x1F\x7F]/g, "");

    // Remove non-ASCII characters
    cleaned = cleaned.replace(/[^\x20-\x7E]/g, "");

    // Remove any double spaces
    cleaned = cleaned.replace(/\s+/g, " ");

    // Skip if empty after cleaning
    if (!cleaned || cleaned.length === 0) continue;

    // Validate cookie format (name=value)
    const nameMatch = cleaned.match(/^([^=]+)=(.*)$/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      const value = nameMatch[2].trim();

      // Skip invalid names or values
      if (name.length === 0 || /[,;\\"]/.test(name)) continue;

      // Reconstruct clean cookie
      cookieMap.set(name, `${name}=${value}`);
    }
  }

  // Join cookies back
  return Array.from(cookieMap.values()).join("; ");
}

/**
 * Get complete browser headers that mimic a real browser
 */
function getBrowserHeaders(referer: string, includeCookies?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    Referer: referer,
    "Cache-Control": "max-age=0",
  };

  if (includeCookies) {
    headers["Cookie"] = includeCookies;
  }

  return headers;
}

/**
 * Merge new cookies from Set-Cookie headers into existing cookie string
 * Properly handles updates and prevents duplicates
 */
function mergeCookies(existingCookies: string, setCookieHeaders: string[]): string {
  // Parse existing cookies into Map
  const cookieMap = new Map<string, string>();

  if (existingCookies) {
    const existing = existingCookies
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    for (const cookie of existing) {
      const nameMatch = cookie.match(/^([^=]+)=/);
      if (nameMatch) {
        cookieMap.set(nameMatch[1].trim(), cookie);
      }
    }
  }

  // Parse and merge new cookies from Set-Cookie headers
  for (const header of setCookieHeaders) {
    // Extract just the cookie part (before first semicolon)
    const cookiePart = header.split(";")[0].trim();
    if (!cookiePart) continue;

    const nameMatch = cookiePart.match(/^([^=]+)=/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      // Update or add cookie (this handles duplicates by overwriting)
      cookieMap.set(name, cookiePart);
    }
  }

  // Join all cookies
  const merged = Array.from(cookieMap.values()).join("; ");

  // Apply comprehensive sanitization
  return sanitizeCookies(merged);
}

/**
 * Validate headers to ensure they don't contain invalid characters
 */
function validateHeaders(headers: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(headers)) {
    // Check for control characters
    if (/[\x00-\x1F\x7F]/.test(value)) {
      console.error(`[VALIDATION] Header '${key}' contains control characters`);
      return false;
    }

    // Check for non-ASCII characters
    if (!/^[\x20-\x7E ]*$/.test(value)) {
      console.error(`[VALIDATION] Header '${key}' contains non-ASCII characters`);
      return false;
    }

    // Check for excessive length (8KB limit per header)
    if (value.length > 8192) {
      console.error(`[VALIDATION] Header '${key}' exceeds 8KB limit (${value.length} bytes)`);
      return false;
    }
  }

  return true;
}

/**
 * Log detailed cookie information for debugging
 */
function logCookieDetails(cookies: string, prefix: string = "") {
  const cookieArray = cookies
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const cookieNames = cookieArray.map((c) => c.split("=")[0]);

  console.log(`${prefix} Cookie details:`);
  console.log(`  - Total length: ${cookies.length} bytes`);
  console.log(`  - Cookie count: ${cookieArray.length}`);
  console.log(`  - Cookie names: ${cookieNames.join(", ")}`);
  console.log(`  - Contains newlines: ${/[\r\n]/.test(cookies)}`);
  console.log(`  - Contains null bytes: ${/\0/.test(cookies)}`);
  console.log(`  - Contains control chars: ${/[\x00-\x1F\x7F]/.test(cookies)}`);
  console.log(`  - Is ASCII: ${/^[\x20-\x7E; ]*$/.test(cookies)}`);

  // Log individual cookies (truncated)
  cookieArray.forEach((cookie, idx) => {
    const truncated = cookie.length > 50 ? cookie.substring(0, 50) + "..." : cookie;
    console.log(`  - Cookie ${idx + 1}: ${truncated}`);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: ScrapeRequest = await req.json();

    // Check if this is a resume request
    if (payload.jobId || (payload as any).resumeJobId) {
      const resumeJobId = payload.jobId || (payload as any).resumeJobId;
      console.log(`[RESUME] Resuming job ${resumeJobId}`);

      // Get existing job and credentials
      const { data: job, error: jobError } = await supabase
        .from("import_jobs")
        .select("*, user_id")
        .eq("id", resumeJobId)
        .single();

      if (jobError || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get credentials
      const { data: credentials, error: credError } = await supabase
        .from("user_aisis_credentials")
        .select("encrypted_username, encrypted_password")
        .eq("user_id", job.user_id)
        .single();

      if (credError || !credentials) {
        return new Response(JSON.stringify({ error: "AISIS credentials not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract scraping types from partial_data
      const scrapingTypes = job.partial_data?.selected_data_types || [];

      // Build payload from job data
      const resumePayload: ScrapeRequest = {
        jobId: resumeJobId,
        scrapeSchedules: scrapingTypes.includes("schedules"),
        scrapeCurriculum: scrapingTypes.includes("curriculum"),
        scrapeGrades: scrapingTypes.includes("grades"),
        scrapeMySchedule: scrapingTypes.includes("my_schedule"),
        scrapeMyProgram: scrapingTypes.includes("my_program"),
        scrapeMyGrades: scrapingTypes.includes("my_grades"),
        scrapeHoldOrders: scrapingTypes.includes("hold_orders"),
        scrapeAccountInfo: scrapingTypes.includes("account_info"),
      };

      // Start background processing
      processScrapingInBackground(
        supabase,
        resumeJobId,
        job.user_id,
        credentials.encrypted_username,
        credentials.encrypted_password,
        resumePayload,
        scrapingTypes,
      );

      return new Response(
        JSON.stringify({
          success: true,
          jobId: resumeJobId,
          message: "Scraping job resumed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine which scraping types are selected
    const scrapingTypes = [];
    if (payload.scrapeSchedules) scrapingTypes.push("schedules");
    if (payload.scrapeCurriculum) scrapingTypes.push("curriculum");
    if (payload.scrapeGrades) scrapingTypes.push("grades");
    if (payload.scrapeMySchedule) scrapingTypes.push("my_schedule");
    if (payload.scrapeMyProgram) scrapingTypes.push("my_program");
    if (payload.scrapeMyGrades) scrapingTypes.push("my_grades");
    if (payload.scrapeHoldOrders) scrapingTypes.push("hold_orders");
    if (payload.scrapeAccountInfo) scrapingTypes.push("account_info");

    console.log("[INFO] Scraping types selected:", scrapingTypes);

    // Get user credentials
    const { data: credentials, error: credError } = await supabase
      .from("user_aisis_credentials")
      .select("encrypted_username, encrypted_password")
      .eq("user_id", user.id)
      .single();

    if (credError || !credentials) {
      return new Response(JSON.stringify({ error: "AISIS credentials not found. Please add them in settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create import job with selected data types stored in partial_data
    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .insert({
        user_id: user.id,
        job_type: "aisis_scrape",
        status: "pending",
        progress: 0,
        partial_data: {
          selected_data_types: scrapingTypes,
          start_time: new Date().toISOString(),
          scrape_mode: "server",
        },
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("[SCRAPER] Failed to create import job:", jobError);
      throw new Error(`Failed to create import job: ${jobError?.message || "Unknown error"}`);
    }

    // Start background processing with scraping types
    processScrapingInBackground(
      supabase,
      job.id,
      user.id,
      credentials.encrypted_username,
      credentials.encrypted_password,
      payload,
      scrapingTypes,
    );

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        message: "Scraping job started",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log top-level error to function_logs
    try {
      const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await serviceClient.from("function_logs").insert({
        function_name: "aisis-scraper",
        level: "error",
        event_type: "error",
        event_message: "AISIS scraper error",
        details: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
      });
    } catch (_) {}

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processScrapingInBackground(
  serviceClient: any,
  jobId: string,
  userId: string,
  encryptedUsername: string,
  encryptedPassword: string,
  payload: ScrapeRequest,
  scrapingTypes: string[],
) {
  const JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  let timeoutId: number | null = null;
  let lastHeartbeat = Date.now();

  try {
    console.log("=== Background scraping started ===");
    console.log(`[INFO] Scraping types: ${scrapingTypes.join(", ")}`);

    // Check if resuming from checkpoint
    const { data: existingJob } = await serviceClient
      .from("import_jobs")
      .select("progress_checkpoint, partial_data")
      .eq("id", jobId)
      .single();

    const checkpoint = existingJob?.progress_checkpoint;
    const resuming = checkpoint && checkpoint.current_type;

    if (resuming) {
      console.log("[RESUME] Resuming from checkpoint:", checkpoint);
      await recordLog(serviceClient, jobId, "info", "Resuming AISIS scraping from checkpoint", { checkpoint });
    } else {
      await recordLog(serviceClient, jobId, "info", "Starting AISIS scraping", { scrapingTypes });
    }

    await updateJobStatus(serviceClient, jobId, "processing", 0);

    // Set up timeout to mark job as incomplete after 15 minutes
    timeoutId = setTimeout(async () => {
      console.error("[TIMEOUT] Job exceeded 15 minute timeout");
      await recordLog(serviceClient, jobId, "warn", "Job timed out after 15 minutes");

      const { data: currentJob } = await serviceClient
        .from("import_jobs")
        .select("partial_data")
        .eq("id", jobId)
        .single();

      await serviceClient
        .from("import_jobs")
        .update({
          status: "incomplete",
          error_message: "Job timed out after 15 minutes. Data may be partially scraped.",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          partial_data: {
            ...(currentJob?.partial_data || {}),
            termination_reason: "timeout",
          },
        })
        .eq("id", jobId);
    }, JOB_TIMEOUT_MS);

    // Helper function to check control action and send heartbeat
    const checkControlAndHeartbeat = async () => {
      const now = Date.now();
      if (now - lastHeartbeat > 30000) {
        // Heartbeat every 30 seconds
        await serviceClient.from("import_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
        lastHeartbeat = now;
      }

      const { data: job } = await serviceClient.from("import_jobs").select("control_action").eq("id", jobId).single();

      return job?.control_action || null;
    };

    // Decrypt credentials (simple base64 for now - in production use proper encryption)
    const username = atob(encryptedUsername);
    const password = atob(encryptedPassword);
    console.log("Credentials decrypted");

    // Login to AISIS with retries
    console.log("Starting login process...");
    await recordLog(serviceClient, jobId, "info", "Logging in to AISIS...");

    let session: AISISSession | null = null;
    let loginAttempts = 0;

    while (!session && loginAttempts < MAX_RETRIES) {
      try {
        session = await loginToAISIS(username, password);
        if (!session) {
          loginAttempts++;
          if (loginAttempts < MAX_RETRIES) {
            console.log(`Login attempt ${loginAttempts} failed, retrying...`);
            await delay(RATE_LIMIT_DELAY * loginAttempts); // Exponential backoff
          }
        }
      } catch (error) {
        loginAttempts++;
        console.error(`Login attempt ${loginAttempts} error:`, error);
        if (loginAttempts >= MAX_RETRIES) {
          throw error;
        }
        await delay(RATE_LIMIT_DELAY * loginAttempts);
      }
    }

    if (!session) {
      throw new Error("Failed to login to AISIS after multiple attempts. Please check your credentials.");
    }

    console.log("Login successful!");
    await recordLog(serviceClient, jobId, "info", "Successfully logged in to AISIS");

    // Session warm-up: GET welcome.do to establish session
    console.log("[SESSION] Warming up session with GET welcome.do");
    try {
      const warmupResponse = await fetchWithTimeout(`${AISIS_BASE_URL}/welcome.do`, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Cookie: session.cookies,
          Referer: `${AISIS_BASE_URL}/welcome.do`,
        },
      });
      console.log(
        `[SESSION] Warm-up complete: ${warmupResponse.status} (${(await warmupResponse.text()).length} bytes)`,
      );
      await recordLog(serviceClient, jobId, "info", "Session warm-up complete", {
        status: warmupResponse.status,
      });
    } catch (warmupError) {
      console.warn("[SESSION] Warm-up failed (non-critical):", warmupError);
    }

    // Update last used timestamp
    await serviceClient
      .from("user_aisis_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Execute scraping operations sequentially with pause/resume support
    let currentProgress = 20;
    const progressPerType = 70 / scrapingTypes.length;

    // Determine starting point from checkpoint or start fresh
    const completedTypes = checkpoint?.completed_types || [];
    const startTypeIndex = checkpoint?.current_type ? scrapingTypes.indexOf(checkpoint.current_type) : 0;

    for (let i = startTypeIndex >= 0 ? startTypeIndex : 0; i < scrapingTypes.length; i++) {
      const type = scrapingTypes[i];

      // Skip already completed types
      if (completedTypes.includes(type)) {
        console.log(`[INFO] Skipping already completed: ${type}`);
        currentProgress += progressPerType;
        continue;
      }

      // Check for pause command
      const controlAction = await checkControlAndHeartbeat();
      if (controlAction === "pause") {
        console.log("[PAUSE] Pause command received");
        await recordLog(serviceClient, jobId, "info", `Pausing at ${type} scraping`);
        await serviceClient
          .from("import_jobs")
          .update({
            status: "paused",
            paused_at: new Date().toISOString(),
            progress_checkpoint: {
              current_type: type,
              current_index: i,
              total_types: scrapingTypes.length,
              completed_types: completedTypes,
              last_timestamp: new Date().toISOString(),
            },
            partial_data: {
              selected_data_types: scrapingTypes,
              ...(checkpoint || {}),
            },
          })
          .eq("id", jobId);
        return; // Exit function gracefully
      }

      console.log(`[INFO] Starting ${type} scraping (${i + 1}/${scrapingTypes.length})`);
      await recordLog(serviceClient, jobId, "info", `Starting ${type} scraping`);

      if (type === "curriculum") {
        await scrapeCurriculum(serviceClient, session, jobId, userId, checkControlAndHeartbeat);
      } else if (type === "schedules") {
        await scrapeSchedules(serviceClient, session, jobId, userId, checkControlAndHeartbeat);
      } else if (type === "grades") {
        await scrapeGrades(serviceClient, session, jobId, userId);
      } else if (type === "my_schedule") {
        await scrapeMySchedule(session.cookies, session.sessionId, userId, jobId, serviceClient);
      } else if (type === "my_program") {
        await scrapeMyProgram(session.cookies, session.sessionId, userId, jobId, serviceClient);
      } else if (type === "my_grades") {
        await scrapeMyGrades(session.cookies, session.sessionId, userId, jobId, serviceClient);
      } else if (type === "hold_orders") {
        await scrapeHoldOrders(session.cookies, session.sessionId, userId, jobId, serviceClient);
      } else if (type === "account_info") {
        await scrapeAccountInfo(session.cookies, session.sessionId, userId, jobId, serviceClient);
      }

      completedTypes.push(type);
      currentProgress += progressPerType;
      await updateJobStatus(serviceClient, jobId, "processing", Math.round(currentProgress));
      console.log(`[INFO] Completed ${type} scraping (${Math.round(currentProgress)}%)`);
    }

    await updateJobStatus(serviceClient, jobId, "completed", 100);
    await recordLog(serviceClient, jobId, "info", "Scraping completed successfully");
    console.log("=== Scraping completed successfully ===");
  } catch (error) {
    console.error("Background scraping error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Determine if this is a real failure or just incomplete
    const isAuthError = errorMessage.includes("credentials") || errorMessage.includes("login");
    const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("network");
    const shouldMarkFailed = isAuthError || isNetworkError;

    await recordLog(
      serviceClient,
      jobId,
      "error",
      `Scraping ${shouldMarkFailed ? "failed" : "interrupted"}: ${errorMessage}`,
      {
        error: errorStack,
        errorDetails: error,
      },
    );

    const { data: currentJob } = await serviceClient
      .from("import_jobs")
      .select("partial_data")
      .eq("id", jobId)
      .single();

    await serviceClient
      .from("import_jobs")
      .update({
        status: shouldMarkFailed ? "failed" : "incomplete",
        error_message: errorMessage,
        error_details: { message: errorMessage, stack: errorStack },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        partial_data: {
          ...(currentJob?.partial_data || {}),
          termination_reason: shouldMarkFailed ? "error" : "interrupted",
        },
      })
      .eq("id", jobId);
  } finally {
    // Clear timeout if it was set
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Final safety check: ensure job isn't stuck in processing state
    try {
      const { data: job } = await serviceClient.from("import_jobs").select("status").eq("id", jobId).single();

      if (job?.status === "processing") {
        console.warn("[SAFETY CHECK] Job still in processing state, marking as incomplete");
        await recordLog(serviceClient, jobId, "warn", "Job ended unexpectedly - safety check triggered");
        await serviceClient
          .from("import_jobs")
          .update({
            status: "incomplete",
            error_message: "Job ended unexpectedly. Data may be partially scraped.",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    } catch (finalCheckError) {
      console.error("[SAFETY CHECK] Error during final status check:", finalCheckError);
    }
  }
}

// PHASE 1: Fixed Authentication
async function loginToAISIS(username: string, password: string): Promise<AISISSession | null> {
  try {
    console.log("=== Starting AISIS Login ===");

    // Step 1: Fetch login page to get rnd token
    console.log("Fetching login page...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const loginPageResponse = await fetch(`${AISIS_BASE_URL}/displayLogin.do`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!loginPageResponse.ok) {
      console.error("Login page fetch failed:", loginPageResponse.status);
      return null;
    }

    const loginPageHtml = await loginPageResponse.text();
    console.log(`Received ${loginPageHtml.length} bytes from login page`);

    // Extract rnd token
    const rndMatch = loginPageHtml.match(/name="rnd"\s+value="([^"]+)"/);
    if (!rndMatch) {
      console.error("Could not find rnd token");
      console.error("HTML sample:", loginPageHtml.substring(0, 500));
      return null;
    }
    const rndToken = rndMatch[1];
    console.log("Extracted rnd token");

    // Get cookies from login page using proper merging
    const setCookieHeaders = loginPageResponse.headers.getSetCookie();
    let cookies = mergeCookies("", setCookieHeaders);
    console.log("Initial cookies obtained");
    logCookieDetails(cookies, "[LOGIN INITIAL]");

    // Step 2: Submit login credentials with FIXED field names
    console.log("Submitting credentials...");
    const formData = new URLSearchParams({
      userName: username, // FIXED: Changed from 'username' to 'userName'
      password: password,
      command: "login", // FIXED: Added command field
      submit: "Sign in", // FIXED: Added submit field
      rnd: rndToken,
    });

    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), REQUEST_TIMEOUT);

    const loginResponse = await fetch(`${AISIS_BASE_URL}/login.do`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: formData.toString(),
      signal: controller2.signal,
    });
    clearTimeout(timeoutId2);

    console.log("Login response status:", loginResponse.status);

    // Merge cookies from login response (don't replace, merge!)
    const loginSetCookies = loginResponse.headers.getSetCookie();
    if (loginSetCookies.length > 0) {
      cookies = mergeCookies(cookies, loginSetCookies);
      console.log("Cookies merged after login");
      logCookieDetails(cookies, "[LOGIN MERGED]");
    }

    // Verify login success
    const loginResponseText = await loginResponse.text();
    console.log(`Login response: ${loginResponseText.length} bytes`);

    // Check for error indicators
    if (
      loginResponseText.toLowerCase().includes("invalid") ||
      loginResponseText.toLowerCase().includes("incorrect") ||
      loginResponseText.toLowerCase().includes("failed") ||
      loginResponseText.toLowerCase().includes("error")
    ) {
      console.error("Login failed - response indicates error");
      console.error("Response snippet:", loginResponseText.substring(0, 500));
      return null;
    }

    // Check for success indicators
    if (
      loginResponseText.toLowerCase().includes("welcome") ||
      loginResponse.url.includes("welcome.do") ||
      loginResponseText.includes("J_VOFC.do")
    ) {
      console.log("Login success verified");
    }

    // Final sanitization and validation
    const finalCookies = sanitizeCookies(cookies);

    // Validate headers before returning
    if (!validateHeaders({ Cookie: finalCookies })) {
      console.error("[LOGIN] Cookie validation failed - contains invalid characters");
      return null;
    }

    logCookieDetails(finalCookies, "[LOGIN FINAL]");

    // Extract JSESSIONID
    const sessionMatch = finalCookies.match(/JSESSIONID=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : `session_${Date.now()}`;

    console.log("=== Login Successful ===");

    return {
      cookies: finalCookies,
      sessionId,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Login request timed out");
      return null;
    }
    console.error("Login error:", error);
    return null;
  }
}

// PHASE 2: Complete Curriculum Scraping
async function scrapeCurriculum(
  serviceClient: any,
  session: AISISSession,
  jobId: string,
  userId: string,
  checkControl?: () => Promise<string | null>,
) {
  try {
    console.log("=== Starting Curriculum Scrape ===");
    await recordLog(serviceClient, jobId, "info", "Fetching program list");

    // Fetch program list
    const url = `${AISIS_BASE_URL}/J_VOFC.do`;
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Cookie: session.cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = await response.text();
    console.log(`[CURRICULUM] Received ${html.length} bytes from program list page`);

    // Parse programs with improved regex matching Chrome extension
    const programs = parseProgramList(html);

    console.log(`[CURRICULUM] Found ${programs.length} degree programs`);
    await recordLog(serviceClient, jobId, "info", `Found ${programs.length} degree programs`, {
      programCount: programs.length,
    });

    if (programs.length === 0) {
      console.error("[CURRICULUM] No programs found - HTML sample:", html.substring(0, 500));
      await recordLog(serviceClient, jobId, "error", "No programs found in curriculum list", {
        htmlSample: html.substring(0, 500),
      });
      return;
    }

    const programsToScrape = programs.length; // Scrape all programs
    await recordLog(serviceClient, jobId, "info", `Will scrape ${programsToScrape} programs`, {
      totalPrograms: programsToScrape,
    });

    // Scrape programs in concurrent batches
    for (let batchStart = 0; batchStart < programsToScrape; batchStart += CONCURRENT_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + CONCURRENT_BATCH_SIZE, programsToScrape);
      const batchNum = Math.floor(batchStart / CONCURRENT_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(programsToScrape / CONCURRENT_BATCH_SIZE);
      
      console.log(`[CURRICULUM] Batch ${batchNum}/${totalBatches}: Programs ${batchStart + 1}-${batchEnd}`);
      await recordLog(serviceClient, jobId, "info", `Processing batch ${batchNum}/${totalBatches} (programs ${batchStart + 1}-${batchEnd})`, {
        batchNum,
        totalBatches,
        batchStart: batchStart + 1,
        batchEnd,
      });

      // Check for pause before each batch
      if (checkControl) {
        const controlAction = await checkControl();
        if (controlAction === "pause") {
          console.log("[PAUSE] Pause command received during curriculum batch");
          return;
        }
      }

      // Process batch concurrently
      const batchPrograms = programs.slice(batchStart, batchEnd);
      const batchResults = await Promise.allSettled(
        batchPrograms.map(async (program, idx) => {
          const globalIdx = batchStart + idx;
          console.log(`[CURRICULUM] Fetching ${globalIdx + 1}/${programsToScrape}: ${program.programName} (${program.programCode})`);

          // POST to get specific program curriculum with correct parameters
          const formData = new URLSearchParams({
            ProgCode: program.programCode,
            VerYear: program.versionYear.toString(),
            VerSem: program.versionSem.toString(),
          });

          const startTime = Date.now();
          const requestUrl = `${AISIS_BASE_URL}/J_VOFC.do`;

          const curriculumResponse = await fetchWithTimeout(requestUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Cookie: session.cookies,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            body: formData.toString(),
          });

          const curriculumHtml = await curriculumResponse.text();
          const responseTime = Date.now() - startTime;

          console.log(`[HTTP] Program ${globalIdx + 1} - Status: ${curriculumResponse.status}, Size: ${curriculumHtml.length}B, Time: ${responseTime}ms`);

          // Save raw HTML to scraped_curriculum table FIRST (as placeholder record)
          const { error: htmlSaveError } = await serviceClient.from("scraped_curriculum").insert({
            user_id: userId,
            import_job_id: jobId,
            program_code: program.programCode,
            program_name: program.programName,
            version_year: program.versionYear,
            version_sem: program.versionSem,
            version_label: `${program.versionYear}-${program.versionSem}`,
            track_code: null,
            raw_html: curriculumHtml,
            scraped_at: new Date().toISOString(),
            // Placeholder values for required fields
            course_code: "PLACEHOLDER",
            course_title: "Raw HTML Data",
            units: 0,
            year_level: 0,
            semester: "N/A",
            category: "RAW_DATA",
            prerequisites: [],
            is_placeholder: true,
          });

          if (htmlSaveError) {
            console.error(`[CURRICULUM] Error saving raw HTML for ${program.programName}:`, htmlSaveError);
            throw htmlSaveError;
          }

          console.log(`[CURRICULUM] ✓ Saved raw HTML for ${program.programName}`);

          // Parse curriculum and save individual courses
          const parsedCourses = parseCurriculumTable(curriculumHtml, userId, jobId, program, curriculumHtml);
          console.log(`[CURRICULUM] Extracted ${parsedCourses.length} courses from ${program.programName}`);

          // Save parsed courses to scraped_curriculum table
          if (parsedCourses.length > 0) {
            const { error: insertError } = await serviceClient.from("scraped_curriculum").insert(parsedCourses);

            if (!insertError) {
              console.log(`[CURRICULUM] ✓ Saved ${parsedCourses.length} parsed courses for ${program.programName}`);
            } else {
              console.error(`[CURRICULUM] Error saving parsed courses for ${program.programName}:`, insertError);
              throw insertError;
            }
          } else {
            console.warn(`[CURRICULUM] No courses extracted for ${program.programName}`);
          }

          return { program, parsedCourses };
        })
      );

      // Log batch results
      const successCount = batchResults.filter(r => r.status === 'fulfilled').length;
      const failCount = batchResults.filter(r => r.status === 'rejected').length;
      
      console.log(`[CURRICULUM] Batch ${batchNum}/${totalBatches} complete: ${successCount} success, ${failCount} failed`);
      await recordLog(serviceClient, jobId, "info", `Batch ${batchNum}/${totalBatches} complete`, {
        successCount,
        failCount,
        batchProgress: `${batchEnd}/${programsToScrape}`,
      });

      // Log individual failures
      batchResults.forEach((result, idx) => {
        if (result.status === 'rejected') {
          const globalIdx = batchStart + idx;
          const program = batchPrograms[idx];
          console.error(`[CURRICULUM] Failed to process ${program.programName}:`, result.reason);
        }
      });

      // Delay between batches
      if (batchEnd < programsToScrape) {
        await delay(RATE_LIMIT_DELAY);
      }
    }

    console.log(`[CURRICULUM] ✓ Scraping complete: ${programsToScrape} programs`);
    await recordLog(serviceClient, jobId, "info", `Curriculum scraping complete`, { programCount: programsToScrape });
  } catch (error) {
    console.error("[CURRICULUM] Scraping error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    await recordLog(serviceClient, jobId, "error", "Curriculum scraping failed", {
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
}

function parseProgramList(html: string): ProgramInfo[] {
  const programs: ProgramInfo[] = [];

  console.log("[PARSE] Starting program list extraction");
  console.log("[PARSE] HTML length:", html.length);

  // Parse options with multiple fallback patterns
  const optionRegex = /<option value="([^"]+)">([^<]+)<\/option>/g;
  let match;
  let totalOptions = 0;

  while ((match = optionRegex.exec(html)) !== null) {
    totalOptions++;

    if (!match[1] || match[1] === "" || match[1].startsWith("--")) {
      continue;
    }

    const value = match[1];
    const text = match[2].trim();

    // Pattern 1: (CODE) NAME(Ver Sem X, Ver Year YYYY)
    const pattern1 = /\(([^)]+)\)\s*(.+?)\(Ver Sem (\d+), Ver Year (\d+)\)/;
    const match1 = text.match(pattern1);

    if (match1) {
      console.log(`[REGEX] Pattern 1 matched: ${text}`);
      programs.push({
        value,
        text,
        programCode: match1[1].trim(),
        programName: match1[2].trim(),
        versionSem: parseInt(match1[3]),
        versionYear: parseInt(match1[4]),
      });
      continue;
    }

    // Pattern 2: CODE - NAME (Ver YYYY-X)
    const pattern2 = /([A-Z\s-]+?)\s*-\s*(.+?)\s*\(Ver\s+(\d{4})-(\d+)\)/;
    const match2 = text.match(pattern2);

    if (match2) {
      console.log(`[REGEX] Pattern 2 matched: ${text}`);
      programs.push({
        value,
        text,
        programCode: match2[1].trim(),
        programName: match2[2].trim(),
        versionSem: parseInt(match2[4]),
        versionYear: parseInt(match2[3]),
      });
      continue;
    }

    // Pattern 3: NAME Ver Sem X, Ver Year YYYY (no CODE parentheses)
    const pattern3 = /(.+?)\s+Ver Sem (\d+), Ver Year (\d+)/;
    const match3 = text.match(pattern3);

    if (match3) {
      console.log(`[REGEX] Pattern 3 matched: ${text}`);
      // Extract code from beginning
      const codeMatch = match3[1].match(/^([A-Z\s-]+)/);
      programs.push({
        value,
        text,
        programCode: codeMatch ? codeMatch[1].trim() : value,
        programName: match3[1].trim(),
        versionSem: parseInt(match3[2]),
        versionYear: parseInt(match3[3]),
      });
      continue;
    }

    // Pattern 4: Any other format with year/version info
    const yearMatch = text.match(/(\d{4})/);
    const semMatch = text.match(/[Ss]em\s*(\d+)|[Ss]emester\s*(\d+)/);

    if (yearMatch || semMatch) {
      console.log(`[REGEX] Pattern 4 matched (year/sem detection): ${text}`);
      programs.push({
        value,
        text,
        programCode: value,
        programName: text,
        versionSem: semMatch ? parseInt(semMatch[1] || semMatch[2]) : 1,
        versionYear: yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear(),
      });
      continue;
    }

    // Fallback: Use raw value and text
    console.log(`[REGEX] No pattern matched, using fallback: ${text.substring(0, 50)}`);
    programs.push({
      value,
      text,
      programCode: value,
      programName: text,
      versionSem: 1,
      versionYear: new Date().getFullYear(),
    });
  }

  console.log(`[EXTRACT] Program list: Found ${programs.length} programs out of ${totalOptions} total options`);
  console.log(`[EXTRACT] Sample programs:`, programs.slice(0, 3));

  return programs;
}

function parseCurriculumTable(
  html: string,
  userId: string,
  jobId: string,
  program: ProgramInfo,
  rawHtml: string,
): any[] {
  const courses: any[] = [];

  console.log(`[PARSE] Starting curriculum table parse for ${program.programName}`);

  // Find table with "Course Title" header
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let dataTable = null;
  let tableCount = 0;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    tableCount++;
    const tableHTML = tableMatch[0];

    // Check if this table contains curriculum data headers
    if (/Course\s*Title/i.test(tableHTML) || /Cat\s*No/i.test(tableHTML)) {
      console.log(`[PARSE] Found curriculum table (table #${tableCount})`);
      dataTable = tableHTML;
      break;
    }
  }

  if (!dataTable) {
    console.log(
      `[PARSE] No curriculum table found. Checked ${tableCount} tables. HTML sample:`,
      html.substring(0, 300),
    );
    return [];
  }

  // Parse table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const matches = Array.from(dataTable.matchAll(rowRegex));
  console.log(`[PARSE] Found ${matches.length} rows in table`);

  let currentYear = 1;
  let currentSemester = "1st Sem";
  let currentCategory = "Core";
  let rowsProcessed = 0;
  let coursesExtracted = 0;

  for (const match of matches) {
    rowsProcessed++;
    const row = match[1];
    const cleanRow = row
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Detect year level headers
    if (/(?:First|1st|I)\s*Year/i.test(cleanRow)) {
      currentYear = 1;
      console.log(`[PARSE] Detected year header: ${cleanRow.substring(0, 50)} → Year ${currentYear}`);
      continue;
    }
    if (/(?:Second|2nd|II)\s*Year/i.test(cleanRow)) {
      currentYear = 2;
      console.log(`[PARSE] Detected year header: ${cleanRow.substring(0, 50)} → Year ${currentYear}`);
      continue;
    }
    if (/(?:Third|3rd|III)\s*Year/i.test(cleanRow)) {
      currentYear = 3;
      console.log(`[PARSE] Detected year header: ${cleanRow.substring(0, 50)} → Year ${currentYear}`);
      continue;
    }
    if (/(?:Fourth|4th|IV)\s*Year/i.test(cleanRow)) {
      currentYear = 4;
      console.log(`[PARSE] Detected year header: ${cleanRow.substring(0, 50)} → Year ${currentYear}`);
      continue;
    }
    if (/(?:Fifth|5th|V)\s*Year/i.test(cleanRow)) {
      currentYear = 5;
      console.log(`[PARSE] Detected year header: ${cleanRow.substring(0, 50)} → Year ${currentYear}`);
      continue;
    }

    // Detect semester headers
    if (/(?:1st|First)\s*(?:Sem|Semester|Term)/i.test(cleanRow)) {
      currentSemester = "1st Sem";
      console.log(`[PARSE] Detected semester: ${cleanRow.substring(0, 50)} → ${currentSemester}`);
      continue;
    }
    if (/(?:2nd|Second)\s*(?:Sem|Semester|Term)/i.test(cleanRow)) {
      currentSemester = "2nd Sem";
      console.log(`[PARSE] Detected semester: ${cleanRow.substring(0, 50)} → ${currentSemester}`);
      continue;
    }
    if (/Summer/i.test(cleanRow)) {
      currentSemester = "Summer";
      console.log(`[PARSE] Detected semester: ${cleanRow.substring(0, 50)} → ${currentSemester}`);
      continue;
    }

    // Detect category headers
    if (/(?:Core|Required|Major)\s*(?:Courses?|Requirements?)/i.test(cleanRow)) {
      currentCategory = "Core";
      console.log(`[PARSE] Detected category: ${cleanRow.substring(0, 50)} → ${currentCategory}`);
      continue;
    }
    if (/(?:Elective)\s*(?:Courses?)/i.test(cleanRow)) {
      currentCategory = "Elective";
      console.log(`[PARSE] Detected category: ${cleanRow.substring(0, 50)} → ${currentCategory}`);
      continue;
    }
    if (/Free\s*Elective/i.test(cleanRow)) {
      currentCategory = "Free Elective";
      console.log(`[PARSE] Detected category: ${cleanRow.substring(0, 50)} → ${currentCategory}`);
      continue;
    }

    // Extract table cells
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(cellText);
    }

    if (cells.length < 2) continue;

    // Try to extract course code from cells
    // Pattern: DEPT NUM (e.g., CS 11, MATH 101, ENGG 10)
    let courseCode = "";
    let courseTitle = "";
    let units = 3;

    for (const cell of cells) {
      // Match course code pattern: DEPT NUMB (e.g., "MATH 1", "CS 123")
      const courseMatch = cell.match(/\b([A-Z]{2,6})\s+(\d{1,3}[A-Z]?)\b/);
      if (courseMatch && !courseCode) {
        courseCode = `${courseMatch[1]} ${courseMatch[2]}`;
      }

      // Match units
      const unitsMatch = cell.match(/\b(\d+(?:\.\d+)?)\s*(?:unit|u\b)/i);
      if (unitsMatch) {
        units = parseFloat(unitsMatch[1]);
      }
    }

    // If we found a course code, try to extract title
    if (courseCode) {
      // Title is usually in the cell after course code
      courseTitle = cells.find((c) => c.length > 10 && !c.includes(courseCode) && !/\d+\s*unit/i.test(c)) || courseCode;

      // Check if it's a placeholder
      const isPlaceholder = /(?:Elective|Free Elective|TBA|To Be Announced)/i.test(courseTitle);

      courses.push({
        user_id: userId,
        program_name: program.programName,
        program_code: program.programCode,
        track_code: null,
        version_label: `Ver Sem ${program.versionSem}, Ver Year ${program.versionYear}`,
        version_year: program.versionYear,
        version_sem: program.versionSem,
        year_level: currentYear,
        semester: currentSemester,
        course_code: courseCode,
        course_title: courseTitle,
        units: Math.round(units),
        category: currentCategory,
        prerequisites: [],
        is_placeholder: isPlaceholder,
        import_job_id: jobId,
        raw_html: null, // Only store raw HTML in placeholder record
        scraped_at: new Date().toISOString(),
      });
    }
  }

  return courses;
}

/**
 * Schedule of Classes Scraping Flow (AISIS J_VCSC.do)
 *
 * This scrapes publicly available course schedules (requires login to access)
 *
 * Flow:
 * 1. GET J_VCSC.do - Initial page load, get available terms/departments
 * 2. POST J_VCSC.do with command=displaySearchForm - Select department
 * 3. POST J_VCSC.do with command=displayResults - Get schedule table
 *
 * Parameters:
 * - command: 'displaySearchForm' or 'displayResults'
 * - applicablePeriod: Term (e.g., '2025-1' for 1st sem 2025)
 * - deptCode: Department code (e.g., 'BIO', 'CS') or '**IE**' for interdisciplinary
 * - subjCode: Usually 'ALL'
 *
 * Table Structure:
 * - Course Code | Section | Title | Units | Schedule | Room | Instructor | Slots
 */
async function scrapeSchedules(
  serviceClient: any,
  session: AISISSession,
  jobId: string,
  userId: string,
  checkControl?: () => Promise<string | null>,
) {
  try {
    console.log("=== Starting Schedule Scrape ===");
    await recordLog(serviceClient, jobId, "info", "Starting schedule scraping");

    // Use correct endpoint: J_VCSC.do (not J_VSOC.do)
    const scheduleUrl = `${AISIS_BASE_URL}/J_VCSC.do`;

    // Validate and sanitize cookies before use
    const sanitizedCookies = sanitizeCookies(session.cookies);

    // Validate headers
    if (!validateHeaders({ Cookie: sanitizedCookies })) {
      const errorMsg = "Invalid cookies detected before schedule scraping - contains invalid characters";
      console.error(`[SCHEDULE] ${errorMsg}`);
      await recordLog(serviceClient, jobId, "error", errorMsg);
      throw new Error(errorMsg);
    }

    // Log detailed cookie information
    logCookieDetails(sanitizedCookies, "[SCHEDULE]");

    console.log(`[SCHEDULE] GET ${scheduleUrl}`);
    console.log(`[SCHEDULE] Cookie validation checks:`);
    console.log(`  - Contains newlines: ${/[\r\n]/.test(sanitizedCookies)}`);
    console.log(`  - Contains null bytes: ${/\0/.test(sanitizedCookies)}`);
    console.log(`  - Contains control chars: ${/[\x00-\x1F\x7F]/.test(sanitizedCookies)}`);
    console.log(`  - Is ASCII: ${/^[\x20-\x7E; ]*$/.test(sanitizedCookies)}`);

    await recordLog(serviceClient, jobId, "info", `Fetching schedule page: ${scheduleUrl}`, {
      cookieLength: sanitizedCookies.length,
      cookieValid: true,
    });

    // Step 0: Initial GET to load the page with full browser headers
    const response = await fetchWithRetry(
      scheduleUrl,
      {
        method: "GET",
        headers: getBrowserHeaders(`${AISIS_BASE_URL}/welcome.do`, sanitizedCookies),
      },
      "SCHEDULE-INITIAL",
    );

    const html = await response.text();
    console.log(`[SCHEDULE] Initial page: ${response.status} (${html.length} bytes)`);
    await recordLog(serviceClient, jobId, "info", `Loaded schedule page (${html.length} bytes)`, {
      status: response.status,
      size: html.length,
    });

    // Parse department/college options from the initial page
    const departments = parseSelectOptions(html, "deptCode");

    console.log(`[SCHEDULE] Found ${departments.length} departments`);
    await recordLog(serviceClient, jobId, "info", `Found ${departments.length} departments`, {
      departmentCount: departments.length,
      departments: departments.slice(0, 10).map((d) => ({ value: d.value, text: d.text })),
    });

    if (departments.length === 0) {
      console.error("[SCHEDULE] No departments found - HTML sample:", html.substring(0, 500));
      await recordLog(serviceClient, jobId, "error", "No departments found in schedule page", {
        htmlSample: html.substring(0, 500),
        responseStatus: response.status,
        url: scheduleUrl,
      });
      return;
    }

    // Parse term/period from the page (default to current year, sem 1)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentSem = currentMonth >= 6 && currentMonth <= 10 ? 1 : 2;
    const applicablePeriod = `${currentYear}-${currentSem}`;

    console.log(`[SCHEDULE] Using term: ${applicablePeriod}`);
    await recordLog(serviceClient, jobId, "info", `Using term: ${applicablePeriod}`);

    let totalSchedules = 0;
    const deptsToScrape = departments.length;
    const totalBatches = Math.ceil(deptsToScrape / DEPARTMENT_BATCH_SIZE) || 1;

    const processDepartment = async (
      dept: { value: string; text: string },
      departmentIndex: number,
      totalDepartments: number,
    ): Promise<{ scheduleCount: number }> => {
      const progressLabel = `${departmentIndex + 1}/${totalDepartments}`;

      try {
        console.log(`[${progressLabel}] Scraping department: ${dept.text} (${dept.value})`);

        await recordLog(serviceClient, jobId, "info", `Scraping schedules for: ${dept.text}`, {
          department: dept.text,
          deptCode: dept.value,
          progress: progressLabel,
        });

        // Step 1: POST with command=displaySearchForm to select department
        console.log(`[SCHEDULE] Step 1: displaySearchForm for ${dept.value}`);
        const formData1 = new URLSearchParams({
          command: "displaySearchForm",
          applicablePeriod: applicablePeriod,
          deptCode: dept.value,
          subjCode: "ALL",
        });

        const formHeaders = getBrowserHeaders(scheduleUrl, sanitizedCookies);
        formHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        formHeaders["Sec-Fetch-Dest"] = "empty";
        formHeaders["Sec-Fetch-Mode"] = "cors";

        const formResponse = await fetchWithRetry(
          scheduleUrl,
          {
            method: "POST",
            headers: formHeaders,
            body: formData1.toString(),
          },
          `SCHEDULE-FORM-${dept.value}`,
        );

        const formHtml = await formResponse.text();
        console.log(`[SCHEDULE] Form loaded: ${formResponse.status} (${formHtml.length} bytes)`);

        // Step 2: POST with command=displayResults to get schedule table
        console.log(`[SCHEDULE] Step 2: displayResults for ${dept.value}`);
        const formData2 = new URLSearchParams({
          command: "displayResults",
          applicablePeriod: applicablePeriod,
          deptCode: dept.value,
          subjCode: "ALL",
        });

        const resultsHeaders = getBrowserHeaders(scheduleUrl, sanitizedCookies);
        resultsHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        resultsHeaders["Sec-Fetch-Dest"] = "empty";
        resultsHeaders["Sec-Fetch-Mode"] = "cors";

        const resultsResponse = await fetchWithRetry(
          scheduleUrl,
          {
            method: "POST",
            headers: resultsHeaders,
            body: formData2.toString(),
          },
          `SCHEDULE-RESULTS-${dept.value}`,
        );

        const scheduleHtml = await resultsResponse.text();
        console.log(`[SCHEDULE] Results: ${resultsResponse.status} (${scheduleHtml.length} bytes)`);

        await recordLog(serviceClient, jobId, "info", `Received schedule results for ${dept.text}`, {
          department: dept.text,
          status: resultsResponse.status,
          size: scheduleHtml.length,
        });

        // Parse schedule table
        const schedules = parseScheduleTable(scheduleHtml, dept.text, applicablePeriod);

        if (schedules.length > 0) {
          const { error: insertError } = await serviceClient.from("aisis_schedules").insert(schedules);

          if (insertError) {
            console.error(`[${dept.text}] Insert error:`, insertError);
            await recordLog(serviceClient, jobId, "error", `Failed to save schedules for ${dept.text}`, {
              department: dept.text,
              deptCode: dept.value,
              error: insertError.message || insertError.details || insertError,
            });
            return { scheduleCount: 0 };
          }

          console.log(`[${dept.text}] Saved ${schedules.length} schedules`);

          await recordLog(serviceClient, jobId, "info", `Scraped ${schedules.length} schedules from ${dept.text}`, {
            department: dept.text,
            schedule_count: schedules.length,
            batchProgress: progressLabel,
          });

          await delay(RATE_LIMIT_DELAY);
          return { scheduleCount: schedules.length };
        } else {
          console.warn(`[${dept.text}] No schedules found`);
          await recordLog(serviceClient, jobId, "warn", `No schedules found for ${dept.text}`, {
            department: dept.text,
            deptCode: dept.value,
          });
          await delay(RATE_LIMIT_DELAY);
          return { scheduleCount: 0 };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SCHEDULE] Error scraping ${dept.text}:`, errorMessage);
        await recordLog(serviceClient, jobId, "error", `Failed to scrape ${dept.text}`, {
          department: dept.text,
          deptCode: dept.value,
          error: errorMessage,
        });
        await delay(RATE_LIMIT_DELAY);
        return { scheduleCount: 0 };
      }
    };

    let processedDepartments = 0;

    for (let batchStart = 0; batchStart < deptsToScrape; batchStart += DEPARTMENT_BATCH_SIZE) {
      if (checkControl) {
        const controlAction = await checkControl();
        if (controlAction === "pause") {
          console.log("[SCHEDULE] Pause command received during schedule scraping");
          return;
        }
      }

      const batchDepartments = departments.slice(
        batchStart,
        Math.min(batchStart + DEPARTMENT_BATCH_SIZE, deptsToScrape),
      );
      const batchIndex = Math.floor(batchStart / DEPARTMENT_BATCH_SIZE) + 1;

      await recordLog(serviceClient, jobId, "info", `Processing schedule batch ${batchIndex}/${totalBatches}`, {
        batchIndex,
        batchSize: batchDepartments.length,
        totalBatches,
      });

      const batchResults = await Promise.all(
        batchDepartments.map((dept, idx) =>
          processDepartment(dept, batchStart + idx, deptsToScrape),
        ),
      );

      for (const result of batchResults) {
        processedDepartments += 1;
        totalSchedules += result.scheduleCount;
      }

      await serviceClient
        .from("import_jobs")
        .update({
          pages_scraped: processedDepartments,
          total_pages: deptsToScrape,
          schedules_processed: totalSchedules,
        })
        .eq("id", jobId);
    }

    await recordLog(serviceClient, jobId, "info", `Schedule scraping complete: ${totalSchedules} schedules`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Schedule scraping error:", errorMessage);
    throw new Error(`Schedule scraping failed: ${errorMessage}`);
  }
}

function parseSelectOptions(html: string, selectName: string): Array<{ value: string; text: string }> {
  console.log(`[PARSE] Looking for select[name="${selectName}"]`);

  // Target the specific select element by name attribute
  const selectRegex = new RegExp(`<select[^>]*\\bname="${selectName}"[^>]*>([\\s\\S]*?)<\\/select>`, "i");
  const selectMatch = html.match(selectRegex);

  if (!selectMatch) {
    console.log(`[PARSE] No select element found with name="${selectName}"`);
    console.log(`[PARSE] HTML snippet: ${html.substring(0, 600)}`);
    return [];
  }

  const selectContent = selectMatch[1];
  console.log(`[PARSE] Found select with ${selectContent.length} chars of content`);

  const options: Array<{ value: string; text: string }> = [];
  const optionRegex = /<option value="([^"]+)">([^<]+)<\/option>/g;
  let match;

  while ((match = optionRegex.exec(selectContent)) !== null) {
    if (match[1] && match[1] !== "" && !match[1].startsWith("--")) {
      options.push({
        value: match[1],
        text: match[2].trim(),
      });
    }
  }

  console.log(`[PARSE] Extracted ${options.length} options from select[name="${selectName}"]`);

  return options;
}

function parseScheduleTable(html: string, department: string, termCode: string): any[] {
  console.log(`[PARSE-SCHEDULE] Parsing schedule table for ${department}`);
  console.log(`[PARSE-SCHEDULE] HTML size: ${html.length} bytes`);

  const schedules: any[] = [];

  // Find the main schedule table (look for table with class containing "data" or "schedule")
  const tableMatch = html.match(/<table[^>]*(?:class="[^"]*(?:data|schedule|result)[^"]*")?[^>]*>([\s\S]*?)<\/table>/i);

  if (!tableMatch) {
    console.log(`[PARSE-SCHEDULE] No schedule table found`);
    console.log(`[PARSE-SCHEDULE] HTML sample: ${html.substring(0, 1000)}`);
    return [];
  }

  console.log(`[PARSE-SCHEDULE] Found table, extracting rows...`);

  // Parse table rows
  const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const matches = Array.from(html.matchAll(tableRegex));
  console.log(`[PARSE-SCHEDULE] Found ${matches.length} rows`);

  for (let i = 0; i < matches.length; i++) {
    const row = matches[i][1];

    // Skip header rows
    if (row.includes("<th")) continue;

    // Extract table cells
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(cellText);
    }

    if (cells.length < 5) continue; // Need at least: code, section, title, units, schedule

    // Expected columns: Course Code | Section | Title | Units | Schedule | Room | Instructor
    const subjectCode = cells[0]?.trim() || "";
    const section = cells[1]?.trim() || "";
    const courseTitle = cells[2]?.trim() || "";
    const unitsStr = cells[3]?.trim() || "3";
    const scheduleStr = cells[4]?.trim() || "";
    const room = cells[5]?.trim() || "TBA";
    const instructor = cells[6]?.trim() || "TBA";

    // Validate course code (e.g., "BIO 1", "MATH 101", "CS 21")
    if (!subjectCode.match(/^[A-Z]{2,6}\s+\d{1,3}[A-Z]?$/)) {
      continue;
    }

    // Parse units
    const units = parseFloat(unitsStr) || 3;

    // Parse schedule string (e.g., "MWF 10:00-11:00" or "TTh 13:00-14:30")
    const scheduleMatch = scheduleStr.match(/([MTWFS]+(?:h)?)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);

    if (!scheduleMatch) {
      console.log(`[PARSE-SCHEDULE] Could not parse schedule: "${scheduleStr}" for ${subjectCode}`);
      continue;
    }

    const daysText = scheduleMatch[1];
    const startHour = scheduleMatch[2].padStart(2, "0");
    const startMin = scheduleMatch[3];
    const endHour = scheduleMatch[4].padStart(2, "0");
    const endMin = scheduleMatch[5];

    const startTime = `${startHour}:${startMin}:00`;
    const endTime = `${endHour}:${endMin}:00`;

    // Parse days of week (M=1, T=2, W=3, Th=4, F=5, S=6)
    const daysOfWeek: number[] = [];
    if (daysText.includes("M") && !daysText.includes("Th")) daysOfWeek.push(1);
    if (daysText.includes("T") && !daysText.includes("Th")) daysOfWeek.push(2);
    if (daysText.includes("W")) daysOfWeek.push(3);
    if (daysText.includes("Th")) daysOfWeek.push(4);
    if (daysText.includes("F")) daysOfWeek.push(5);
    if (daysText.includes("S")) daysOfWeek.push(6);

    if (daysOfWeek.length === 0) {
      console.log(`[PARSE-SCHEDULE] No valid days found in: "${daysText}"`);
      continue;
    }

    schedules.push({
      subject_code: subjectCode,
      course_title: courseTitle,
      section: section,
      instructor: instructor,
      room: room,
      time_pattern: scheduleStr,
      days_of_week: daysOfWeek,
      start_time: startTime,
      end_time: endTime,
      department: department,
      units: units,
      deprecated: false,
      import_source: "user_scrape",
      term_code: termCode,
    });

    console.log(`[PARSE-SCHEDULE] ✓ ${subjectCode} ${section} - ${courseTitle}`);
  }

  console.log(`[PARSE-SCHEDULE] Successfully parsed ${schedules.length} courses from ${department}`);
  return schedules;
}

// PHASE 4: Complete Grades Scraping
async function scrapeGrades(serviceClient: any, session: AISISSession, jobId: string, userId: string) {
  try {
    console.log("=== Starting Grades Scrape ===");

    // Fetch grades/transcript page
    const url = `${AISIS_BASE_URL}/J_VGRD.do`;
    console.log("Fetching grades page...");

    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Cookie: session.cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = await response.text();
    console.log(`Received ${html.length} bytes from grades page`);

    const grades = parseGradesTable(html, userId);

    if (grades.length > 0) {
      console.log(`Parsed ${grades.length} grade records`);

      // Upsert grades
      for (const grade of grades) {
        await serviceClient.from("user_courses").upsert(grade, {
          onConflict: "user_id,course_code,semester,school_year",
        });
      }

      await recordLog(serviceClient, jobId, "info", `Scraped ${grades.length} grade records`, {
        grades_count: grades.length,
      });
    } else {
      console.warn("No grades found");
      await recordLog(serviceClient, jobId, "warn", "No grades found", {
        html_snippet: html.substring(0, 500),
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Grades scraping error:", errorMessage);
    throw new Error(`Grades scraping failed: ${errorMessage}`);
  }
}

function parseGradesTable(html: string, userId: string): any[] {
  const grades: any[] = [];

  // Parse table rows
  const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const matches = Array.from(html.matchAll(tableRegex));

  let currentSchoolYear = "";
  let currentSemester = "";

  for (const match of matches) {
    const row = match[1];
    const cleanRow = row
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract school year (YYYY-YYYY)
    const yearMatch = cleanRow.match(/(\d{4})[-\/](\d{4})/);
    if (yearMatch) {
      currentSchoolYear = `${yearMatch[1]}-${yearMatch[2]}`;
    }

    // Extract semester
    if (/(?:1st|First)\s*(?:Sem|Semester|Term)/i.test(cleanRow)) {
      currentSemester = "1st Sem";
    } else if (/(?:2nd|Second)\s*(?:Sem|Semester|Term)/i.test(cleanRow)) {
      currentSemester = "2nd Sem";
    } else if (/Summer/i.test(cleanRow)) {
      currentSemester = "Summer";
    }

    // Extract table cells
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .trim();
      cells.push(cellText);
    }

    if (cells.length < 3) continue;

    // Extract course code
    let courseCode = "";
    for (const cell of cells) {
      const courseMatch = cell.match(/\b([A-Z]{2,6})\s+(\d{1,3}[A-Z]?)\b/);
      if (courseMatch) {
        courseCode = `${courseMatch[1]} ${courseMatch[2]}`;
        break;
      }
    }

    if (!courseCode) continue;

    // Extract grade
    const gradeMatch = cleanRow.match(/\b([A-F][+-]?|[SUWIPDROP]{1,3}|INC|DRP)\b/);
    if (!gradeMatch) continue;

    const grade = gradeMatch[1].toUpperCase();

    // Extract title and units
    const courseTitle = cells.find((c) => c.length > 10 && !c.includes(courseCode) && !c.match(/\d{4}/)) || courseCode;
    const unitsMatch = cleanRow.match(/\b(\d+(?:\.\d+)?)\s*(?:unit|u\b)/i);
    const units = unitsMatch ? Math.round(parseFloat(unitsMatch[1])) : 3;

    // Calculate QPI value
    const qpiValue = getQPIValue(grade);
    const countsForQPI = qpiValue !== null;

    grades.push({
      user_id: userId,
      course_code: courseCode,
      course_title: courseTitle,
      units,
      grade,
      qpi_value: qpiValue,
      counts_for_qpi: countsForQPI,
      school_year: currentSchoolYear || "Unknown",
      semester: currentSemester || "Unknown",
      grading_basis: ["S", "U", "P"].includes(grade) ? "pass_fail" : "letter",
      term_code:
        currentSchoolYear && currentSemester
          ? `${currentSchoolYear.split("-")[0]}${currentSemester === "1st Sem" ? "1" : currentSemester === "2nd Sem" ? "2" : "3"}`
          : null,
    });
  }

  return grades;
}

function getQPIValue(grade: string): number | null {
  const qpiMap: { [key: string]: number } = {
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    D: 1.0,
    F: 0.0,
  };
  return qpiMap[grade] ?? null;
}

// PHASE 6: Helper Functions with Timeout & Retry
async function fetchWithTimeout(url: string, options: any): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT / 1000}s`);
    }
    throw error;
  }
}

/**
 * Fetch with retry logic for transient errors
 * Retries up to 3 times with exponential backoff
 * For SCHEDULE-INITIAL requests, uses extended timeout and progressive headers
 */
async function fetchWithRetry(url: string, options: any, context: string = "request"): Promise<Response> {
  let lastError: Error | null = null;
  const isScheduleInitial = context === "SCHEDULE-INITIAL";
  const maxAttempts = isScheduleInitial ? 3 : MAX_RETRIES;

  // Extended timeout for initial schedule request
  const SCHEDULE_INITIAL_TIMEOUT = 60000; // 60 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Progressive header strategy for initial schedule GET
      let requestOptions = { ...options };
      if (isScheduleInitial && attempt > 1) {
        const cookies = options.headers?.["Cookie"] || "";
        const referer = options.headers?.["Referer"] || `${AISIS_BASE_URL}/welcome.do`;

        if (attempt === 1) {
          // Minimal headers
          requestOptions.headers = {
            "User-Agent": options.headers?.["User-Agent"],
            Cookie: cookies,
            Referer: referer,
          };
        } else if (attempt === 2) {
          // Add Accept headers
          requestOptions.headers = {
            "User-Agent": options.headers?.["User-Agent"],
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            Cookie: cookies,
            Referer: referer,
          };
        } else {
          // Full browser headers
          requestOptions.headers = getBrowserHeaders(referer, cookies);
        }
      }

      const headerProfile =
        isScheduleInitial && attempt > 1 ? (attempt === 2 ? "with-accept" : "full-browser") : "default";

      console.log(`[${context}] Attempt ${attempt}/${maxAttempts}: ${options.method || "GET"} ${url}`);
      console.log(`[${context}] Header profile: ${headerProfile}`);

      // Use extended timeout for initial schedule GET
      const timeoutMs = isScheduleInitial ? SCHEDULE_INITIAL_TIMEOUT : REQUEST_TIMEOUT;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Success!
        if (attempt > 1) {
          console.log(`[${context}] Success on attempt ${attempt} with ${headerProfile} headers`);
        }

        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      lastError = error as Error;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`[${context}] Attempt ${attempt} failed: ${errorMsg}`);

      // Check if it's a header-related error
      const isHeaderError =
        errorMsg.includes("invalid HTTP header") || errorMsg.includes("header") || errorMsg.includes("SendRequest");

      // Don't retry if it's not a transient error and we're past first attempt
      if (!isHeaderError && attempt > 1) {
        throw lastError;
      }

      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[${context}] Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // On header errors, try simplifying headers
        if (isHeaderError && options.headers) {
          console.log(`[${context}] Simplifying headers for retry...`);
          // Keep only essential headers
          const essentialHeaders: Record<string, string> = {
            "User-Agent": options.headers["User-Agent"] || "Mozilla/5.0",
            Referer: options.headers["Referer"] || AISIS_BASE_URL,
          };

          if (options.headers["Cookie"]) {
            essentialHeaders["Cookie"] = options.headers["Cookie"];
          }
          if (options.headers["Content-Type"]) {
            essentialHeaders["Content-Type"] = options.headers["Content-Type"];
          }

          options.headers = essentialHeaders;
        }
      }
    }
  }

  // All retries failed
  throw new Error(`${context} failed after ${maxAttempts} attempts: ${lastError?.message || "Unknown error"}`);
}

async function updateJobStatus(serviceClient: any, jobId: string, status: string, progress: number) {
  try {
    const updates: any = {
      status,
      progress,
      updated_at: new Date().toISOString(),
    };

    if (status === "processing" && progress === 0) {
      updates.started_at = new Date().toISOString();
    }

    if (status === "completed" || status === "failed") {
      updates.completed_at = new Date().toISOString();
    }

    await serviceClient.from("import_jobs").update(updates).eq("id", jobId);
  } catch (error) {
    console.error("Failed to update job status:", error);
  }
}

// FIXED: recordLog now uses import_job_id
async function recordLog(client: any, jobId: string, level: string, message: string, details?: any) {
  const logEntry = {
    function_name: "aisis-scraper",
    import_job_id: jobId,
    level,
    event_type: "Log",
    event_message: message,
    metadata: details || {},
    created_at: new Date().toISOString(),
  };

  console.log(`[LOG] ${level.toUpperCase()}: ${message}`, details || "");

  const { error } = await client.from("function_logs").insert(logEntry);

  if (error) {
    console.error("[CRITICAL] Failed to record log to database:", error);
    console.error("[CRITICAL] Log entry was:", logEntry);
  }
}

// Scrape My Class Schedule
async function scrapeMySchedule(cookies: string, sessionId: string, userId: string, jobId: string, client: any) {
  console.log("[MY_SCHEDULE] Fetching J_VMCS.do");
  const url = "https://aisis.ateneo.edu/j_aisis/J_VMCS.do";
  const response = await fetchWithTimeout(url, { method: "GET", headers: { Cookie: cookies } });
  const html = await response.text();
  console.log(`[MY_SCHEDULE] Got ${html.length} bytes`);
  await recordLog(client, jobId, "info", `Scraped my schedule (${html.length} bytes)`);
  // await recordLog(client, jobId, "info", `schedule: ${html}`);
}

// Scrape My Program of Study
async function scrapeMyProgram(cookies: string, sessionId: string, userId: string, jobId: string, client: any) {
  console.log("[MY_PROGRAM] Fetching J_VIPS.do");
  const url = "https://aisis.ateneo.edu/j_aisis/J_VIPS.do";
  const response = await fetchWithTimeout(url, { method: "GET", headers: { Cookie: cookies } });
  const html = await response.text();
  console.log(`[MY_PROGRAM] Got ${html.length} bytes`);
  await recordLog(client, jobId, "info", `Scraped my program (${html.length} bytes)`);
}

// Scrape My Advisory Grades
async function scrapeMyGrades(cookies: string, sessionId: string, userId: string, jobId: string, client: any) {
  console.log("[MY_GRADES] Fetching J_VADGR.do");
  const url = "https://aisis.ateneo.edu/j_aisis/J_VADGR.do";
  const response = await fetchWithTimeout(url, { method: "GET", headers: { Cookie: cookies } });
  const html = await response.text();
  console.log(`[MY_GRADES] Got ${html.length} bytes`);
  await recordLog(client, jobId, "info", `Scraped my grades (${html.length} bytes)`);
}

// Scrape Hold Orders
async function scrapeHoldOrders(cookies: string, sessionId: string, userId: string, jobId: string, client: any) {
  console.log("[HOLD_ORDERS] Fetching J_VHOD.do");
  const url = "https://aisis.ateneo.edu/j_aisis/J_VHOD.do";
  const response = await fetchWithTimeout(url, { method: "GET", headers: { Cookie: cookies } });
  const html = await response.text();
  console.log(`[HOLD_ORDERS] Got ${html.length} bytes`);
  await recordLog(client, jobId, "info", `Scraped hold orders (${html.length} bytes)`);
}

// Scrape Account Info
async function scrapeAccountInfo(cookies: string, sessionId: string, userId: string, jobId: string, client: any) {
  console.log("[ACCOUNT_INFO] Fetching welcome.do");
  const url = "https://aisis.ateneo.edu/j_aisis/welcome.do";
  const response = await fetchWithTimeout(url, { method: "GET", headers: { Cookie: cookies } });
  const html = await response.text();
  console.log(`[ACCOUNT_INFO] Got ${html.length} bytes`);
  await recordLog(client, jobId, "info", `Scraped account info (${html.length} bytes)`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
