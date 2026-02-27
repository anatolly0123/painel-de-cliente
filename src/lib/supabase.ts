import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://naqbwsrlhnfetqnheyey.supabase.co';
const supabaseAnonKey = 'sb_publishable_wxdWuFTKISUYFMP0ZCoo5Q_bmi2rVdt';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
