import { SupabaseClient } from '@supabase/supabase-js';

interface ToastFunction {
  (props: { title: string; description?: string; variant?: 'default' | 'destructive' }): void;
}

export const exportAsJSON = async (jobId: string, supabase: SupabaseClient, toast: ToastFunction) => {
  try {
    const job = await supabase.from('import_jobs').select('*').eq('id', jobId).single();
    const curriculum = await supabase.from('scraped_curriculum').select('*').eq('import_job_id', jobId);
    const grades = await supabase.from('scraped_my_grades').select('*').eq('import_job_id', jobId);
    const schedule = await supabase.from('scraped_my_schedule').select('*').eq('import_job_id', jobId);
    const program = await supabase.from('scraped_my_program').select('*').eq('import_job_id', jobId);
    const account = await supabase.from('scraped_account_info').select('*').eq('import_job_id', jobId);
    const holds = await supabase.from('scraped_hold_orders').select('*').eq('import_job_id', jobId);
    
    const exportData = {
      metadata: { 
        jobId, 
        exportedAt: new Date().toISOString(), 
        jobStatus: job.data?.status 
      },
      data: { 
        curriculum: curriculum.data || [], 
        grades: grades.data || [],
        schedule: schedule.data || [],
        program: program.data || [],
        account: account.data || [],
        holds: holds.data || []
      },
      statistics: { 
        totalCurriculumCourses: curriculum.data?.length || 0, 
        totalGrades: grades.data?.length || 0,
        totalScheduleItems: schedule.data?.length || 0,
        totalProgramItems: program.data?.length || 0,
        totalAccountInfo: account.data?.length || 0,
        totalHolds: holds.data?.length || 0
      }
    };
    
    downloadFile(JSON.stringify(exportData, null, 2), `aisis-export-${jobId}.json`, 'application/json');
    toast({ title: "Export Complete", description: "JSON file downloaded" });
  } catch (error: any) {
    toast({ title: "Export Failed", description: error.message, variant: "destructive" });
  }
};

export const exportAsCSV = async (jobId: string, supabase: SupabaseClient, toast: ToastFunction) => {
  try {
    const { data } = await supabase.from('scraped_curriculum').select('*').eq('import_job_id', jobId);
    if (data && data.length > 0) {
      const csv = convertToCSV(data);
      downloadFile(csv, `curriculum-${jobId}.csv`, 'text/csv');
      toast({ title: "CSV Exported", description: "Curriculum data exported to CSV" });
    } else {
      toast({ title: "No Data", description: "No curriculum data to export", variant: "destructive" });
    }
  } catch (error: any) {
    toast({ title: "Export Failed", description: error.message, variant: "destructive" });
  }
};

export const exportAsHAR = async (jobId: string, supabase: SupabaseClient, toast: ToastFunction) => {
  try {
    const { data: logs } = await supabase
      .from('function_logs')
      .select('*')
      .eq('import_job_id', jobId)
      .order('created_at', { ascending: true });
    
    const har = {
      log: {
        version: "1.2",
        creator: { name: "AISIS Scraper", version: "2.0" },
        entries: logs?.map((log: any) => ({
          startedDateTime: log.created_at,
          time: (log.metadata as any)?.duration || 0,
          request: {
            method: (log.metadata as any)?.method || "GET",
            url: extractUrlFromMessage(log.event_message) || 'https://aisis.ateneo.edu/j_aisis/',
            httpVersion: "HTTP/1.1",
            headers: []
          },
          response: {
            status: 200,
            content: { text: log.event_message }
          }
        })) || []
      }
    };
    
    downloadFile(JSON.stringify(har, null, 2), `aisis-har-${jobId}.har`, 'application/json');
    toast({ title: "HAR Export Complete", description: "HTTP Archive exported" });
  } catch (error: any) {
    toast({ title: "Export Failed", description: error.message, variant: "destructive" });
  }
};

export const exportAsHTML = async (jobId: string, supabase: SupabaseClient, toast: ToastFunction) => {
  try {
    const { data: job } = await supabase.from('import_jobs').select('*').eq('id', jobId).single();
    const { data: curriculum } = await supabase.from('scraped_curriculum').select('*').eq('import_job_id', jobId);
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>AISIS Scraping Report - ${jobId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>AISIS Scraping Report</h1>
  <p><strong>Job ID:</strong> ${jobId}</p>
  <p><strong>Status:</strong> ${job?.status}</p>
  <p><strong>Created:</strong> ${job?.created_at}</p>
  <p><strong>Completed:</strong> ${job?.completed_at || 'In Progress'}</p>
  <h2>Curriculum Data (${curriculum?.length || 0} courses)</h2>
  <table>
    <thead>
      <tr>
        <th>Course Code</th>
        <th>Course Title</th>
        <th>Units</th>
        <th>Program</th>
      </tr>
    </thead>
    <tbody>
      ${curriculum?.slice(0, 100).map((course: any) => `
        <tr>
          <td>${course.course_code}</td>
          <td>${course.course_title}</td>
          <td>${course.units}</td>
          <td>${course.program_name}</td>
        </tr>
      `).join('') || '<tr><td colspan="4">No data</td></tr>'}
    </tbody>
  </table>
  ${curriculum && curriculum.length > 100 ? `<p><em>Showing first 100 of ${curriculum.length} courses</em></p>` : ''}
</body>
</html>`;
    
    downloadFile(html, `aisis-report-${jobId}.html`, 'text/html');
    toast({ title: "HTML Report Complete", description: "Visual report exported" });
  } catch (error: any) {
    toast({ title: "Export Failed", description: error.message, variant: "destructive" });
  }
};

export const exportRawData = async (jobId: string, supabase: SupabaseClient, toast: ToastFunction) => {
  try {
    const { data: curriculum } = await supabase
      .from('scraped_curriculum')
      .select('raw_html, program_name, program_code')
      .eq('import_job_id', jobId)
      .eq('is_placeholder', true);
    
    const rawData = {
      jobId,
      exportedAt: new Date().toISOString(),
      rawHtmlData: curriculum || []
    };
    
    downloadFile(JSON.stringify(rawData, null, 2), `aisis-raw-${jobId}.json`, 'application/json');
    toast({ title: "Raw Data Exported", description: "Raw HTML data exported" });
  } catch (error: any) {
    toast({ title: "Export Failed", description: error.message, variant: "destructive" });
  }
};

export const exportRawLogs = async (jobId: string, supabase: SupabaseClient, toast: ToastFunction) => {
  try {
    const { data: logs } = await supabase
      .from('function_logs')
      .select('*')
      .eq('import_job_id', jobId)
      .order('created_at', { ascending: true });
    
    const logText = logs?.map((log: any) => 
      `[${log.created_at}] [${log.log_level.toUpperCase()}] ${log.event_message}\n`
    ).join('') || '';
    
    downloadFile(logText, `aisis-logs-${jobId}.txt`, 'text/plain');
    toast({ title: "Logs Exported", description: "Log file downloaded" });
  } catch (error: any) {
    toast({ title: "Export Failed", description: error.message, variant: "destructive" });
  }
};

// Helper function to convert data to CSV format
export const convertToCSV = (data: any[]): string => {
  if (!data.length) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map((row: any) => 
    Object.values(row).map((v: any) => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      return str.includes(',') || str.includes('"') || str.includes('\n') 
        ? `"${str.replace(/"/g, '""')}"` 
        : str;
    }).join(',')
  );
  return [headers, ...rows].join('\n');
};

// Helper function to extract URL from log message
export const extractUrlFromMessage = (message: string): string | null => {
  const urlMatch = message.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : null;
};

// Helper function to download a file
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
