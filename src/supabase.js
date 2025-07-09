import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pecotcxpcqfkwvyylvjv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlY290Y3hwY3Fma3d2eXlsdmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNjc1NDQsImV4cCI6MjA2NzY0MzU0NH0.DYbgJHjSuyJ-a6Iy_2w8uhUcXu_p9k6BZV0_DGyIG04";

export const supabase = createClient(supabaseUrl, supabaseKey);
