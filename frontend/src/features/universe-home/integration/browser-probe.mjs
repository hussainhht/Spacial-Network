/** Browser-only React/Three diagnostics; never imported by production UI. */
export function installUniverseProbe() {
      const roots = new Set();
      const renderers = new Map();
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        renderers,
        inject(renderer) {
          const id = renderers.size + 1;
          renderers.set(id, renderer);
          return id;
        },
        onCommitFiberRoot(_id, root) { roots.add(root); },
        onCommitFiberUnmount() {},
        onPostCommitFiberRoot() {},
        checkDCE() {},
      };
      window.__universeAudit = {
        snapshot() {
          const objects = new Map();
          const stores = new Set();
          const visit = (fiber) => {
            if (!fiber) return;
            const object = fiber.stateNode?.object || fiber.memoizedProps?.object;
            if (object?.isObject3D && object.name) objects.set(object.name, object);
            const value = fiber.memoizedProps?.value;
            if (typeof value?.getState === "function" && value.getState().gl) stores.add(value);
            visit(fiber.child);
            visit(fiber.sibling);
          };
          for (const root of roots) visit(root.current);
          const render = [...stores].map((store) => {
            const { gl, frameloop, viewport, scene } = store.getState();
            scene.traverse((object) => { if (object.name) objects.set(object.name, object); });
            const context = gl.getContext();
            const debug = context.getExtension("WEBGL_debug_renderer_info");
            return {
              frameloop, dpr: viewport.dpr,
              calls: gl.info.render.calls,
              triangles: gl.info.render.triangles,
              memory: { ...gl.info.memory },
              renderer: context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER),
            };
          });
          const rect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          };
          return {
            url: location.href,
            active: document.querySelector('[data-universe-scene="home"]')?.dataset.activePlanet,
            mainCount: document.querySelectorAll("main").length,
            canvasCount: document.querySelectorAll("canvas").length,
            pinSpacers: document.querySelectorAll(".pin-spacer").length,
            triggers: window.ScrollTrigger?.getAll().map((trigger) => ({
              id: trigger.vars.id, progress: trigger.progress, start: trigger.start, end: trigger.end,
            })) ?? null,
            pane: rect("#page-content"),
            viewport: rect("[data-universe-viewport]"),
            scroll: document.querySelector("#page-content")?.scrollTop,
            overflowX: document.documentElement.scrollWidth > innerWidth,
            bodyOverflow: document.body.style.overflow,
            inert: [...document.querySelectorAll("[inert]")].map((el) => el.id || el.dataset.universeScene || el.tagName),
            objects: [...objects].filter(([name]) => /Root|EarthSystem|MoonOffset/.test(name)).map(([name, object]) => ({
              name, uuid: object.uuid, parent: object.parent?.name,
              position: object.position.toArray(), rotation: object.rotation.toArray(), scale: object.scale.toArray(),
            })),
            render,
          };
        },
      };
}
