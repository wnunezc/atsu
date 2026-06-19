# AGENTS.md — atsu

## Alcance

Este contrato aplica a todo el proyecto `atsu`.

## Tipo de proyecto

- Extension de navegador basada en JavaScript, HTML y CSS.
- Manifest V3.
- Sin framework ni proceso de compilacion identificado.

## Reglas de desarrollo

- Mantener compatibilidad con Manifest V3 y las APIs declaradas en `manifest.json`.
- Usar JavaScript nativo y APIs WebExtension/Chrome existentes; no agregar dependencias sin necesidad explicita.
- No usar `eval`, `new Function`, HTML remoto ni ejecucion de codigo descargado.
- Validar y normalizar datos provenientes de storage, mensajes, pestañas y contenido de paginas.
- Mantener permisos y `host_permissions` en el minimo necesario.
- No insertar datos no confiables mediante `innerHTML`; preferir `textContent` y construccion explicita del DOM.
- No agregar funcionalidades, telemetria ni accesos de red no solicitados.
- Mantener sincronizadas las versiones visibles en manifest, documentacion y artefactos de publicacion.

## Estructura principal

- `manifest.json`: metadatos, permisos y puntos de entrada.
- `background.js`: service worker de la extension.
- `src/js/content.js`: logica inyectada en paginas compatibles.
- `src/js/popup.js`: logica de la interfaz emergente.
- `src/html/popup.html`: estructura del popup.
- `src/css/popup.css`: estilos del popup.
- `src/json/`: configuracion y traducciones.

## Validacion minima

- Validar que `manifest.json` sea JSON correcto.
- Ejecutar comprobacion sintactica sobre todos los archivos JavaScript.
- Buscar referencias de version desincronizadas.
- Revisar permisos, CSP, mensajeria, storage, manipulacion del DOM y llamadas de red.
- Cargar la extension desempaquetada en un navegador Chromium para la validacion funcional cuando el entorno lo permita.

## Restricciones operativas

- No existe repositorio Git en esta carpeta al crear este contrato.
- No asumir que una fase o release esta completada sin confirmacion explicita del usuario.
- Seguir tambien `D:/OpsZone/DevWorkspace/AGENTS.md` y `D:/OpsZone/DevWorkspace/WORKSPACE-HARNESS.md`.
