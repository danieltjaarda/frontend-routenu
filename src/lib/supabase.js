import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.error('Please add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to your .env file');
  console.error('See SUPABASE-SETUP.md for instructions');
}

if (!supabaseUrl || supabaseUrl === 'your-project-url' || !supabaseUrl.startsWith('http')) {
  throw new Error(
    'Invalid Supabase URL. Please set REACT_APP_SUPABASE_URL in your .env file.\n' +
    'Example: REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co\n' +
    'See SUPABASE-SETUP.md for setup instructions.'
  );
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key') {
  throw new Error(
    'Invalid Supabase Anon Key. Please set REACT_APP_SUPABASE_ANON_KEY in your .env file.\n' +
    'See SUPABASE-SETUP.md for setup instructions.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

