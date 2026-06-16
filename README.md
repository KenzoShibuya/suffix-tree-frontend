# Suffix Tree — Frontend

Frontend web para el buscador indexado de documentos y detector de plagio basado en suffix trees con Ukkonen.

## Stack

- **Vite** (build tool)
- **Vanilla JS** (sin framework)
- **CSS** nativo con diseño glassmorphism

## Funcionalidades

1. **Ctrl+F indexado** — subir PDF/TXT, cargar en el suffix tree, buscar patrones en O(m) con resaltado en el texto y visualización de la ruta en el árbol.
2. **Detección de plagio** — subir un corpus de documentos de referencia, construir el árbol generalizado y detectar coincidencias en el documento sospechoso con spans resaltados por fuente.
3. **Benchmark** — ejecuta comparaciones contra búsqueda ingenua O(n·m) en textos de 100k, 500k y 1M caracteres, con tabla y gráfico de barras.

## Requisitos

- Node.js >= 18
- pnpm >= 8

## Inicializar

```bash
pnpm install
```

## Desarrollo

```bash
pnpm dev
# http://localhost:5173
```

El proxy de Vite redirige las llamadas a la API al backend en `http://localhost:8000`.

## Producción

```bash
pnpm build
# genera los archivos estáticos en dist/
```

El frontend asume que el backend FastAPI corre en el mismo dominio o que el proxy está configurado.
