import { ModelArkError } from "./types";

/** OpenAPI host for ModelArk private asset library (ap-southeast-1). */
export const DEFAULT_ARK_ASSET_BASE_URL = "https://ark.ap-southeast-1.byteplusapi.com";

const GROUP_NAME = "brewai";
const API_VERSION = "2024-01-01";

// ponytail: process-local cache; Redis if multi-instance matters
const groupByKey = new Map<string, string>();
const assetByUrl = new Map<string, string>();

type AssetKind = "Image" | "Video" | "Audio";

export function isAssetUri(url: string): boolean {
  return /^asset:\/\//i.test(url.trim());
}

export function toAssetUri(id: string): string {
  const trimmed = id.trim();
  if (isAssetUri(trimmed)) return trimmed.replace(/^Asset:\/\//i, "asset://");
  return `asset://${trimmed.replace(/^asset:\/\//i, "")}`;
}

export function createArkAssetClient(options: {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}) {
  const baseUrl = (options.baseUrl ?? process.env.ARK_ASSET_BASE_URL ?? DEFAULT_ARK_ASSET_BASE_URL).replace(
    /\/$/,
    "",
  );
  const fetchImpl = options.fetch ?? fetch;
  const auth = `Bearer ${options.apiKey.trim()}`;
  const key = options.apiKey.trim();

  async function action(name: string, body: Record<string, unknown>) {
    const url = `${baseUrl}/?Action=${encodeURIComponent(name)}&Version=${API_VERSION}`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await readJson(response);
    if (!response.ok) throw new ModelArkError(response.status, payload);
    const error = asRecord(asRecord(payload).ResponseMetadata).Error;
    if (error && Object.keys(error).length) throw new ModelArkError(400, payload);
    return asRecord(asRecord(payload).Result ?? payload);
  }

  async function ensureGroupId(): Promise<string> {
    const cached = groupByKey.get(key);
    if (cached) return cached;

    const listed = await action("ListAssetGroups", {
      PageNumber: 1,
      PageSize: 50,
      Filter: { Name: GROUP_NAME, GroupType: "AIGC" },
    });
    const items = Array.isArray(listed.Items) ? listed.Items : [];
    for (const item of items) {
      const id = stringField(asRecord(item), "Id");
      const name = stringField(asRecord(item), "Name");
      if (id && name?.includes(GROUP_NAME)) {
        groupByKey.set(key, id);
        return id;
      }
    }

    const created = await action("CreateAssetGroup", {
      Name: GROUP_NAME,
      Description: "BrewAI Seedance refs",
      GroupType: "AIGC",
    });
    const id = stringField(created, "Id");
    if (!id) throw new ModelArkError(502, { detail: "CreateAssetGroup missing Id" });
    groupByKey.set(key, id);
    return id;
  }

  async function waitActive(assetId: string): Promise<void> {
    for (let i = 0; i < 40; i++) {
      const detail = await action("GetAsset", { Id: assetId });
      const status = stringField(detail, "Status");
      if (status === "Active") return;
      if (status === "Failed") {
        throw new ModelArkError(400, {
          detail: "ModelArk asset processing failed",
          error: detail.Error ?? detail,
        });
      }
      await sleep(1500);
    }
    throw new ModelArkError(504, { detail: "Timed out waiting for ModelArk asset Active" });
  }

  return {
    /** Register https media as asset://; on asset-API failure keep https. */
    async resolveUrl(url: string, kind: AssetKind): Promise<string> {
      if (isAssetUri(url)) return toAssetUri(url);

      const cacheKey = `${key}|${kind}|${url}`;
      const hit = assetByUrl.get(cacheKey);
      if (hit) return hit;

      try {
        const groupId = await ensureGroupId();
        const created = await action("CreateAsset", {
          GroupId: groupId,
          Name: `brewai-${kind.toLowerCase()}-${Date.now().toString(36)}`,
          AssetType: kind,
          URL: url,
        });
        const id = stringField(created, "Id");
        if (!id) throw new ModelArkError(502, { detail: "CreateAsset missing Id" });
        await waitActive(id);
        const uri = toAssetUri(id);
        assetByUrl.set(cacheKey, uri);
        return uri;
      } catch (caught) {
        console.warn("[ark-assets] resolve failed, using https", {
          kind,
          url,
          error: caught instanceof Error ? caught.message : String(caught),
        });
        return url;
      }
    },
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
