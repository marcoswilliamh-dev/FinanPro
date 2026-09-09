# FinanPro V2 — Supabase 1.2.0

Conecta la app con el proyecto Supabase de FinanPro.

Incluye:
- Inicio de sesión anónimo de Supabase.
- Cuentas reales.
- Movimientos reales de ingresos y gastos.
- Categorías desde Supabase.
- Metas y aportes reales.
- RLS para que cada usuario solo vea sus propios datos.
- Trigger para actualizar automáticamente el saldo de la cuenta.
- Trigger para acumular aportes en las metas.
- Persistencia en la nube.

IMPORTANTE:
1. En Supabase Dashboard activa Authentication > Providers > Anonymous Sign-Ins.
2. El APK usa únicamente la publishable key; nunca uses service_role en la app.
3. El esquema de base de datos y RLS ya fueron preparados en el proyecto.
