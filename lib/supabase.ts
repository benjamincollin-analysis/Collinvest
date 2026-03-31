import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://iezoejvhsrdpetjopqdl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllem9lanZoc3JkcGV0am9wcWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjk0OTIsImV4cCI6MjA4OTkwNTQ5Mn0._qzgO5u8Tqn6OTOAt0YQIWwF8QvpsAkrlXYRBfuh9eY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
