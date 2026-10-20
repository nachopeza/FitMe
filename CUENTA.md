# Tu cuenta: cómo se monta

La app funciona **entera sin cuenta**. Los datos viven en el móvil, sin conexión
y sin que nadie más los vea. Una cuenta sirve para una cosa concreta: que no se
pierdan si borras la app o cambias de teléfono.

No hay servidor propio: la app es una página estática en GitHub Pages. Para
tener cuenta hace falta un sitio donde guardar los datos, y la app habla con
**Supabase**, que tiene un plan gratuito sin tarjeta. El proyecto es tuyo, los
datos son tuyos y nadie más los lee.

## Los tres pasos

1. **Crea el proyecto.** Entra en [supabase.com](https://supabase.com), crea una
   cuenta y un proyecto nuevo. Elige la región más cercana (Frankfurt, si estás
   en España). Tarda un par de minutos en arrancar.

2. **Crea la tabla.** En el menú del proyecto, **SQL Editor → New query**, pega
   esto y dale a *Run*:

   ```sql
   create table if not exists public.records (
     user_id    uuid not null references auth.users on delete cascade,
     kind       text not null,
     rec_id     text not null,
     data       jsonb,
     updated_at bigint not null,
     deleted    boolean not null default false,
     primary key (user_id, kind, rec_id)
   );

   alter table public.records enable row level security;

   create policy "solo lo mio" on public.records
     for all using (auth.uid() = user_id)
     with check (auth.uid() = user_id);

   alter table public.records
     alter column user_id set default auth.uid();

   create index if not exists records_updated_at
     on public.records (user_id, updated_at);
   ```

   La línea de `row level security` y la política son lo importante: hacen que
   cada cuenta solo pueda leer y escribir sus propias filas, y eso lo decide el
   servidor, no la app.

3. **Pega las claves en la app.** En Supabase, **Settings → API**. Copia la
   *Project URL* y la clave *anon public*. En FitMe, **Perfil → Tu cuenta**,
   pégalas y guarda. Después, crea tu cuenta con tu correo y una contraseña.

La clave *anon* está pensada para ir dentro de una app: no da acceso a nada por
sí sola. Quien decide qué ve cada quien es la política de arriba.

### Si quieres entrar sin confirmar el correo

Por defecto Supabase manda un correo de confirmación. Si prefieres no esperar,
en **Authentication → Sign In / Providers → Email** desactiva *Confirm email*.
La app contempla las dos opciones: si hace falta confirmar, te lo dice.

## Qué se guarda y qué no

Se guardan tu perfil, las pesadas, las comidas, los días, los entrenos, las
rutinas, las comidas habituales, las recetas y los alimentos y ejercicios que
**tú** hayas creado o corregido.

No se sube el catálogo que trae la app —190 alimentos y 96 ejercicios—, porque
es idéntico en todos los dispositivos y serían cientos de filas para nada.
Tampoco se sube la clave del análisis de fotos con IA: esa se queda en cada
móvil.

## Cómo resuelve un conflicto

Gana la escritura más reciente, registro a registro. No hay mezcla campo a
campo: una comida editada a la vez en dos móviles se queda con la última
versión, no con un híbrido que no escribió nadie. Un borrado gana los empates,
porque es más fácil volver a añadir algo que descubrir que algo que borraste ha
resucitado.

## Si prefieres no tener cuenta

Entonces haz copias de seguridad de vez en cuando: **Perfil → Datos y
privacidad → Exportar**. Baja un archivo con todo, y se puede volver a importar.
Es menos cómodo que la cuenta, pero igual de válido.
