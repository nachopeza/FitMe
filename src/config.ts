/**
 * El proyecto de Supabase de esta instalación.
 *
 * Esto está aquí para que, en un móvil nuevo, lo PRIMERO que pida la app sea el
 * correo y la contraseña y nada más. Si la dirección y la clave vivieran solo en
 * el móvil —que es donde estaban—, al reinstalar habría que volver a pegarlas
 * antes de poder entrar, y eso no es «cargar mis datos»: es montar el proyecto
 * otra vez.
 *
 * ¿Es seguro que la clave esté aquí, en un repositorio público? Sí, y no por
 * descuido: la clave «anon» / «publishable» está DISEÑADA para ir dentro de la
 * app. Viaja en cada petición que hace el navegador, así que cualquiera que
 * abra la web la tiene de todas formas. Lo que protege los datos no es
 * esconderla, es la regla por fila de la base: `auth.uid() = user_id`, que
 * decide el servidor y que hace que con esta clave, sin una sesión iniciada, no
 * se pueda leer ni escribir nada.
 *
 * Lo que NUNCA va aquí es la otra: `service_role` o `sb_secret_…`. Esa sí se
 * salta la regla por fila, y la app la rechaza si se intenta pegar.
 *
 * Si se deja vacío, la app sigue funcionando igual: entonces pide el proyecto
 * en Perfil → Tu cuenta, como hasta ahora, y lo guarda en ese móvil.
 */
export const SUPABASE = {
  /** Project URL. Sale en el panel de Supabase, bajo el nombre del proyecto. */
  url: 'https://dltagtdogcnogwxgwlzk.supabase.co',
  /**
   * La clave pública: «anon public» o «publishable» (sb_publishable_…).
   *
   * Vacía a propósito: es lo único que queda por rellenar. Mientras lo esté, la
   * app pide la clave una vez en cada móvil y funciona igual; en cuanto se
   * ponga, el arranque pasa a pedir solo el correo y la contraseña.
   */
  anonKey: '',
} as const;

/** true si esta instalación trae el proyecto puesto. */
export function hasBuiltInProject(): boolean {
  return SUPABASE.url.startsWith('https://') && SUPABASE.anonKey.length > 20;
}
