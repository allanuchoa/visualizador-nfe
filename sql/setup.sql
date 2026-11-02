-- ============================================================================
-- Onboarding da ferramenta `visualizador-nfe` — Registry Supabase (idempotente)
-- ============================================================================
-- ONDE RODAR
--   Supabase SQL Editor (Dashboard). Roda como `service_role`, que bypassa RLS.
--   Pode reexecutar à vontade: `ON CONFLICT` evita duplicatas e erros.
--
-- ANTES DE RODAR
--   O e-mail do Bloco 2 já vem preenchido. Se houver mais usuários, separe os
--   e-mails por vírgula. Nada mais precisa ser preenchido.
--
-- CONTRATO RLS DO REGISTRY
--   Este script APENAS faz INSERT em `applications` e `user_applications`.
--   Nunca crie ou recrie policies nessas tabelas: policies que referenciam as
--   próprias tabelas do registry causam recursão infinita (erro 42P17) e
--   quebram o portal.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Bloco 1: registro da ferramenta (cobre todas as colunas NOT NULL)
-- ---------------------------------------------------------------------------
INSERT INTO public.applications (slug, name, url, icon, category, is_active, status)
VALUES (
  'visualizador-nfe',
  'Visualizador de NF-e',
  'https://allanuchoa.github.io/visualizador-nfe/',
  'file-text',
  'Financeiro',
  true,
  'active'
)
ON CONFLICT (slug) DO UPDATE SET
  name      = EXCLUDED.name,
  url       = EXCLUDED.url,
  icon      = EXCLUDED.icon,
  category  = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  status    = EXCLUDED.status;

-- ---------------------------------------------------------------------------
-- Bloco 2: acesso dos usuários (por e-mail — nada de caçar UUID no dashboard)
--   Adicione e-mails separados por vírgula. Usa auth.users, que só é legível
--   neste contexto (SQL Editor roda como service_role).
-- ---------------------------------------------------------------------------
INSERT INTO public.user_applications (user_id, application_id)
SELECT u.id, a.id
FROM   auth.users u
CROSS JOIN public.applications a
WHERE  a.slug = 'visualizador-nfe'
  AND  u.email IN ('allanuchoa@hotmail.com')   -- <-- adicione outros e-mails separados por vírgula
ON CONFLICT (user_id, application_id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO (opcional — descomente para conferir)
-- ---------------------------------------------------------------------------
-- SELECT slug, name, url, icon, category, is_active, status
-- FROM   public.applications
-- WHERE  slug = 'visualizador-nfe';

-- SELECT ua.user_id, p.email, app.slug
-- FROM   public.user_applications ua
-- JOIN   public.applications app ON app.id = ua.application_id
-- JOIN   public.profiles        p   ON p.id   = ua.user_id
-- WHERE  app.slug = 'visualizador-nfe';
