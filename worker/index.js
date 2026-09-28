const ALLOWED_ORIGIN = "https://liuxixi1220hhh-beep.github.io";
const LOCATIONS = new Set(["甘熙故居", "老门东（秦淮非遗传习馆）"]);
const PLATFORMS = new Set(["小红书", "抖音", "哔哩哔哩 Bilibili", "微信视频号", "微信公众号", "微博", "快手", "其他"]);
const EXTENSIONS = new Set(["doc", "docx", "pdf", "ppt", "pptx", "mp4"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowOrigin = origin === ALLOWED_ORIGIN || origin === "http://127.0.0.1:4173" ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Teacher-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

function text(request, body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "text/plain; charset=utf-8" },
  });
}

function teacherAuthorized(request, env) {
  const supplied = request.headers.get("X-Teacher-Key");
  return Boolean(env.TEACHER_KEY && supplied && supplied === env.TEACHER_KEY);
}

function safeFileName(name) {
  return String(name || "assignment-file").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 160) || "assignment-file";
}

function locationCode(location) {
  return location.startsWith("甘熙") ? "ganxi" : "laomendong";
}

function validateText(value, label, max = 120) {
  const textValue = String(value || "").trim();
  if (!textValue || textValue.length > max) throw new Error(`${label}不能为空，且不能超过${max}个字符。`);
  return textValue;
}

async function submitAssignment(request, env) {
  const form = await request.formData();
  const studentName = validateText(form.get("studentName"), "姓名", 40);
  const studentId = validateText(form.get("studentId"), "学号", 40);
  const location = validateText(form.get("location"), "见习地点", 40);
  const platform = validateText(form.get("platform"), "发布平台", 40);
  const otherPlatform = String(form.get("otherPlatform") || "").trim();
  const workTitle = validateText(form.get("workTitle"), "作品名称", 160);
  const file = form.get("file");
  if (!/^\d+$/.test(studentId)) throw new Error("学号请填写数字。");
  if (!LOCATIONS.has(location)) throw new Error("见习地点不合法。");
  if (!PLATFORMS.has(platform)) throw new Error("发布平台不合法。");
  if (platform === "其他" && !otherPlatform) throw new Error("请填写其他平台名称。");
  if (!(file instanceof File) || !file.name) throw new Error("请上传作业文件。");
  const extension = file.name.split(".").pop().toLowerCase();
  if (!EXTENSIONS.has(extension)) throw new Error("文件格式不支持。");

  const existing = await env.DB.prepare(
    "SELECT id, file_key FROM assignments WHERE student_id = ?1 AND location = ?2 LIMIT 1"
  ).bind(studentId, location).first();
  const id = existing?.id || crypto.randomUUID();
  const fileKey = `assignments/${locationCode(location)}/${studentId}/${id}-${Date.now()}-${safeFileName(file.name)}`;
  const displayPlatform = platform === "其他" ? otherPlatform : platform;
  await env.BUCKET.put(fileKey, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: { studentId, location, workTitle },
  });

  try {
    if (existing) {
      await env.DB.prepare(
        "UPDATE assignments SET student_name = ?1, platform = ?2, other_platform = ?3, display_platform = ?4, work_title = ?5, file_name = ?6, file_type = ?7, file_size = ?8, file_key = ?9, submitted_at = ?10 WHERE id = ?11"
      ).bind(studentName, platform, otherPlatform, displayPlatform, workTitle, file.name, file.type || "application/octet-stream", file.size || 0, fileKey, new Date().toISOString(), id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO assignments (id, student_name, student_id, location, platform, other_platform, display_platform, work_title, file_name, file_type, file_size, file_key, submitted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
      ).bind(id, studentName, studentId, location, platform, otherPlatform, displayPlatform, workTitle, file.name, file.type || "application/octet-stream", file.size || 0, fileKey, new Date().toISOString()).run();
    }
  } catch (error) {
    await env.BUCKET.delete(fileKey);
    throw error;
  }

  if (existing?.file_key && existing.file_key !== fileKey) await env.BUCKET.delete(existing.file_key);
  return json(request, { ok: true, overwritten: Boolean(existing), id, submittedAt: new Date().toISOString() });
}

async function listAssignments(request, env) {
  if (!teacherAuthorized(request, env)) return json(request, { error: "教师口令不正确。" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT id, student_name AS studentName, student_id AS studentId, location, platform, display_platform AS displayPlatform, work_title AS workTitle, file_name AS fileName, file_type AS fileType, file_size AS fileSize, submitted_at AS submittedAt FROM assignments ORDER BY submitted_at DESC"
  ).all();
  return json(request, { records: results || [] });
}

async function downloadAssignment(request, env, id) {
  if (!teacherAuthorized(request, env)) return json(request, { error: "教师口令不正确。" }, 401);
  const record = await env.DB.prepare("SELECT file_key, file_name, file_type FROM assignments WHERE id = ?1 LIMIT 1").bind(id).first();
  if (!record) return text(request, "File not found", 404);
  const object = await env.BUCKET.get(record.file_key);
  if (!object) return text(request, "File not found", 404);
  const headers = new Headers(corsHeaders(request));
  headers.set("Content-Type", record.file_type || "application/octet-stream");
  headers.set("Content-Length", String(object.size));
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(record.file_name)}`);
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return json(request, { ok: true, service: "feiyi-assignment-api" });
      if (url.pathname === "/api/submissions" && request.method === "POST") return await submitAssignment(request, env);
      if (url.pathname === "/api/submissions" && request.method === "GET") return await listAssignments(request, env);
      const fileMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/file$/);
      if (fileMatch && request.method === "GET") return await downloadAssignment(request, env, fileMatch[1]);
      return text(request, "Not found", 404);
    } catch (error) {
      return json(request, { error: error instanceof Error ? error.message : "服务器处理失败，请稍后重试。" }, 400);
    }
  },
};
