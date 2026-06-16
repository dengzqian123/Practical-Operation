import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Dashscope-Key, X-Dashscope-Region",
};

const T2V_MODELS = new Set([
  "happyhorse-1.0-t2v",
  "wan2.7-t2v-2026-04-25",
  "wan2.7-t2v",
  "wan2.6-t2v",
]);

const R2V_MODELS = new Set([
  "happyhorse-1.0-r2v",
]);

const V2V_MODELS = new Set([
  "happyhorse-1.0-video-edit",
]);

const I2V_NEW_API = new Set([
  "happyhorse-1.0-i2v",
  "wan2.7-i2v",
  "wan2.7-i2v-2026-04-25",
]);

const I2V_LEGACY_API = new Set([
  "wan2.6-i2v-flash",
  "wan2.6-i2v",
  "wan2.5-i2v-preview",
  "wan2.2-i2v-flash",
  "wan2.2-i2v-plus",
  "wanx2.1-i2v-plus",
  "wanx2.1-i2v-turbo",
]);

const IMG_MODELS = new Set([
  "wan2.7-image-pro",
  "wan2.7-image",
]);

function getDashscopeEndpoint(region: string): string {
  if (region === "intl" || region === "singapore") {
    return "https://dashscope-intl.aliyuncs.com";
  }
  return "https://dashscope.aliyuncs.com";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/aliyun-video/, "");

    // GET /task/:taskId — poll any task status (video or image)
    if (req.method === "GET" && path.startsWith("/task/")) {
      const taskId = path.replace("/task/", "");
      const apiKey = req.headers.get("X-Dashscope-Key");
      const region = req.headers.get("X-Dashscope-Region") || "intl";

      if (!apiKey) {
        return Response.json({ error: "Missing X-Dashscope-Key" }, { status: 400, headers: corsHeaders });
      }

      const base = getDashscopeEndpoint(region);
      const res = await fetch(`${base}/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      return Response.json(data, { headers: corsHeaders });
    }

    // POST /generate — create a new video generation task
    if (req.method === "POST" && path === "/generate") {
      const body = await req.json() as {
        model: string;
        prompt: string;
        imageUrl?: string;
        imageUrls?: string[];
        editVideoUrl?: string;
        resolution?: string;
        duration?: number;
        ratio?: string;
        promptExtend?: boolean;
        watermark?: boolean;
      };

      const apiKey = req.headers.get("X-Dashscope-Key");
      if (!apiKey) {
        return Response.json({ error: "Missing X-Dashscope-Key" }, { status: 400, headers: corsHeaders });
      }

      const regionHeader = req.headers.get("X-Dashscope-Region") || "intl";
      const { model, prompt, imageUrl, imageUrls, editVideoUrl, resolution = "720P", duration = 5, ratio = "16:9", promptExtend = true, watermark = false } = body;

      const base = getDashscopeEndpoint(regionHeader);
      const endpoint = `${base}/api/v1/services/aigc/video-generation/video-synthesis`;

      let requestBody: Record<string, unknown>;

      if (T2V_MODELS.has(model)) {
        requestBody = {
          model,
          input: { prompt },
          parameters: { resolution, ratio, duration, watermark },
        };
      } else if (V2V_MODELS.has(model)) {
        const media: { type: string; url: string }[] = [];
        if (editVideoUrl) media.push({ type: "video", url: editVideoUrl });
        if (imageUrls && imageUrls.length > 0) {
          imageUrls.slice(0, 5).forEach((url) => media.push({ type: "reference_image", url }));
        } else if (imageUrl) {
          media.push({ type: "reference_image", url: imageUrl });
        }
        requestBody = {
          model,
          input: { prompt, media },
          parameters: { resolution },
        };
      } else if (R2V_MODELS.has(model)) {
        const media = (imageUrls && imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [])
          .map((url) => ({ type: "reference_image", url }));
        requestBody = {
          model,
          input: { prompt, media },
          parameters: { resolution, ratio, duration, watermark },
        };
      } else if (I2V_NEW_API.has(model)) {
        const media: { type: string; url: string }[] = [];
        if (imageUrl) media.push({ type: "first_frame", url: imageUrl });
        requestBody = {
          model,
          input: { prompt, media: media.length > 0 ? media : undefined },
          parameters: { resolution, duration, watermark },
        };
      } else if (I2V_LEGACY_API.has(model)) {
        requestBody = {
          model,
          input: { prompt, ...(imageUrl ? { img_url: imageUrl } : {}) },
          parameters: { resolution, duration, prompt_extend: promptExtend, watermark },
        };
      } else {
        requestBody = {
          model,
          input: { prompt },
          parameters: { resolution, duration, ratio, watermark, prompt_extend: promptExtend },
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log("[aliyun-video] generate response status:", res.status);
      console.log("[aliyun-video] generate response body:", JSON.stringify(data));
      return Response.json(data, { status: res.ok ? 200 : res.status, headers: corsHeaders });
    }

    // POST /image-generate — create a new image generation/editing task
    if (req.method === "POST" && path === "/image-generate") {
      const body = await req.json() as {
        model: string;
        prompt: string;
        imageUrl?: string;
        size?: string;
        n?: number;
        watermark?: boolean;
      };

      const apiKey = req.headers.get("X-Dashscope-Key");
      if (!apiKey) {
        return Response.json({ error: "Missing X-Dashscope-Key" }, { status: 400, headers: corsHeaders });
      }

      const regionHeader = req.headers.get("X-Dashscope-Region") || "intl";
      const { model, prompt, imageUrl, size = "2K", n = 1, watermark = false } = body;

      if (!IMG_MODELS.has(model)) {
        return Response.json({ error: `Unknown image model: ${model}` }, { status: 400, headers: corsHeaders });
      }

      const base = getDashscopeEndpoint(regionHeader);
      const endpoint = `${base}/api/v1/services/aigc/image-generation/generation`;

      // Build content array: always include text, optionally include image
      const content: Record<string, string>[] = [{ text: prompt }];
      if (imageUrl) content.push({ image: imageUrl });

      const requestBody = {
        model,
        input: {
          messages: [
            { role: "user", content },
          ],
        },
        parameters: {
          size,
          n,
          watermark,
          thinking_mode: true,
        },
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log("[aliyun-video] image-generate response status:", res.status);
      console.log("[aliyun-video] image-generate response body:", JSON.stringify(data));
      return Response.json(data, { status: res.ok ? 200 : res.status, headers: corsHeaders });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });

  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders });
  }
});
