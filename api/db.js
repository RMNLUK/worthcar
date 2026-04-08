import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function getAdminOTP(email, code) {
  const { data, error } = await supabase
    .from('AdminOTP')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .eq('used', false)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'OTP not found or already used' };
  if (new Date(data.expires_at) < new Date()) return { success: false, error: 'OTP expired' };

  return { success: true, data };
}

export async function markOTPUsed(id) {
  const { error } = await supabase
    .from('AdminOTP')
    .update({ used: true })
    .eq('id', id);

  return { success: !error, error: error?.message };
}

export async function saveContactEnquiry(full_name, email, phone, message) {
  const { error } = await supabase
    .from('ContactEnquiry')
    .insert([{ full_name, email, phone, message }]);

  return { success: !error, error: error?.message };
}

export async function getActivePrompt() {
  const { data, error } = await supabase
    .from('PromptVersion')
    .select('prompt_text')
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data?.prompt_text || null;
}

export async function getAppConfig(key) {
  const { data, error } = await supabase
    .from('AppConfig')
    .select('value')
    .eq('key', key)
    .single();

  if (error) return null;
  return data?.value || null;
}
