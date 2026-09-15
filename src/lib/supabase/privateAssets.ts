import { createAdminClient } from "./admin";
import { getSupabaseUrl } from "./env";
const bucketName=()=>process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim()||"generated-images";
export function ownedStoragePath(raw:string,userId:string):string|null {
  try {
    const supabaseUrl=getSupabaseUrl();
    if(!supabaseUrl)return null;
    const url=new URL(raw),base=new URL(supabaseUrl);
    if(url.origin!==base.origin)return null;
    const match=url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if(!match||decodeURIComponent(match[1])!==bucketName())return null;
    const path=decodeURIComponent(match[2]);
    if(path.split("/")[1]!==userId || path.split("/").some(part=>part===".."||part==="."))return null;
    return path;
  }catch{return null;}
}
export async function signStoragePath(path:string):Promise<string> {
  const {data,error}=await createAdminClient().storage.from(bucketName()).createSignedUrl(path,3600);
  if(error||!data?.signedUrl)throw new Error("Medienzugriff konnte nicht erstellt werden.");
  return data.signedUrl;
}
async function trySignStoragePath(path: string, fallback: string): Promise<string> {
  try {
    return await signStoragePath(path);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[privateAssets] sign failed", path, error);
    }
    return fallback;
  }
}

/** Refresh expiring asset URLs only within this user's storage prefix. */
export async function hydratePrivateAssets<T>(input:T,userId:string):Promise<T> {
  const cache=new Map<string,Promise<string>>();
  async function visit(value:unknown):Promise<unknown> {
    if(typeof value==="string"){
      const path=ownedStoragePath(value,userId);if(!path)return value;
      if(!cache.has(path))cache.set(path,trySignStoragePath(path,value));
      return cache.get(path)!;
    }
    if(Array.isArray(value))return Promise.all(value.map(visit));
    if(value&&typeof value==="object")return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,v])=>[key,await visit(v)])));
    return value;
  }
  return await visit(input) as T;
}
