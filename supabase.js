// Inicialização do Cliente Supabase
let supabaseClientInstance = null;

function getSupabaseClient() {
  if (!supabaseClientInstance) {
    if (typeof window.supabase === 'undefined') {
      console.error("SDK do Supabase não foi carregado na página.");
      return null;
    }
    
    supabaseClientInstance = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        storageKey: `sb-${CONFIG.SUPABASE_PROJECT_ID}-auth-token`
      }
    });
  }
  return supabaseClientInstance;
}

// // Inicializa a instância global
// const supabase = getSupabaseClient();
