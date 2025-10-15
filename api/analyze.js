export const config = { runtime: "edge" };

function b64ToBytes(b64){const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes;}

export default async function handler(req){
  if(req.method!=="POST") return new Response(JSON.stringify({error:"POST only"}),{status:405});
  const { image_base64, prompt } = await req.json().catch(()=>({}));
  if(!image_base64) return new Response(JSON.stringify({error:"image_base64 required"}),{status:400});

  const GEMINI_KEY = process.env.AIzaSyAUlvSsmYrLv9mObbjBVxk8xHOGDqllZCk;
  const PERPLEXITY_KEY = process.env.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;
  if(!GEMINI_KEY || !PERPLEXITY_KEY) return new Response(JSON.stringify({error:"Missing API keys"}),{status:500});

  const userPrompt = prompt || "Analyze the UI screenshot. Identify key elements, readability/contrast issues, UX problems, and provide 5 actionable fixes.";

  const geminiReq = fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key="+GEMINI_KEY,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:userPrompt},{inline_data:{mime_type:"image/png",data:image_base64}}]}]})
  }).then(async r=>{if(!r.ok) throw new Error("Gemini "+r.status); const j=await r.json(); const text=j?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("
")||JSON.stringify(j); return {provider:"gemini",text}});

  const pplxReq = fetch("https://api.perplexity.ai/chat/completions",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+PERPLEXITY_KEY},
    body:JSON.stringify({model:"sonar-small-online",messages:[{role:"system",content:"You are a concise UI/UX analyst."},{role:"user",content:userPrompt+" Respond in bullet points."}],max_tokens:600,temperature:0.2})
  }).then(async r=>{if(!r.ok) throw new Error("Perplexity "+r.status); const j=await r.json(); const text=j?.choices?.[0]?.message?.content||JSON.stringify(j); return {provider:"perplexity",text}});

  const [g,p]=await Promise.allSettled([geminiReq,pplxReq]);
  const parts=[]; if(g.status==="fulfilled") parts.push("Gemini:
"+g.value.text); if(p.status==="fulfilled") parts.push("Perplexity:
"+p.value.text);
  const result = parts.length?parts.join("

---

"):"Both providers failed. Try again.";
  return new Response(JSON.stringify({result}),{headers:{"Content-Type":"application/json"}});
}
