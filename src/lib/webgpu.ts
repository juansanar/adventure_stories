export type WebGpuSupport = {
  supported: boolean;
  detail: string;
};

export function getWebGpuSupport(): WebGpuSupport {
  if (typeof navigator === "undefined") {
    return { supported: false, detail: "Not in a browser environment." };
  }
  if (!("gpu" in navigator) || !navigator.gpu) {
    return {
      supported: false,
      detail:
        "This browser does not expose WebGPU. Try a recent Chrome, Edge, or Safari Technology Preview on a compatible device.",
    };
  }
  return {
    supported: true,
    detail: "WebGPU is available. Model load and inference still depend on GPU memory and drivers.",
  };
}

export async function probeWebGpuAdapter(): Promise<WebGpuSupport> {
  const base = getWebGpuSupport();
  if (!base.supported) return base;
  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      return {
        supported: false,
        detail:
          "WebGPU is present but no adapter was returned (GPU may be blocked or unavailable).",
      };
    }
    return base;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      supported: false,
      detail: `WebGPU probe failed: ${msg}`,
    };
  }
}
