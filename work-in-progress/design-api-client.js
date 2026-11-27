// Experimental design client; not yet connected to the prototype or verified end to end.
// Supply the current user's access token and the public project key, never a service-role key.
export function createDesignClient({ accessToken, publicKey }) {
  if (!accessToken || !publicKey) throw new Error('User session and public API key required');
  const endpoint = 'https://fgnuaxhujvxkfzzcvdqf.supabase.co/functions/v1/admin-clutch-designs';
  const rest = 'https://fgnuaxhujvxkfzzcvdqf.supabase.co/rest/v1/';
  const headers = { Authorization: `Bearer ${accessToken}`, apikey: publicKey, 'Content-Type': 'application/json' };
  const fields = ['title', 'garment', 'drop_label', 'piece_label', 'canvas'];
  const select = (value, allowed) => Object.fromEntries(allowed.filter(k => Object.hasOwn(value,k)).map(k => [k,value[k]]));
  const validId = id => {
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid item ID');
    return id;
  };
  async function readResponse(response) {
    let data;
    try { data = await response.json(); } catch { throw new Error('Invalid server response'); }
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }
  async function request(method, resource, id, value) {
    const url = new URL(endpoint);
    url.searchParams.set('resource', resource);
    if (id) url.searchParams.set('id', validId(id));
    return readResponse(await fetch(url, { method, headers, ...(value === undefined ? {} : {body: JSON.stringify(value)}), cache: 'no-store' }));
  }
  async function tableRequest(table, method, id, value) {
    const url = new URL(rest + table);
    if (id) url.searchParams.set('id', 'eq.' + validId(id));
    if (table === 'clutch_app_elements' && method === 'GET') url.searchParams.set('order', 'updated_at.desc');
    const response = await fetch(url, { method, headers: {...headers, Prefer:'return=representation'}, ...(value === undefined ? {} : {body: JSON.stringify(value)}), cache:'no-store' });
    return readResponse(response);
  }
  const elementFields = ['title', 'category', 'element'];
  return {
    list: () => request('GET','designs'),
    revisions: id => request('GET','revisions',id),
    create: design => request('POST','designs',null,select(design,fields)),
    update: (id,changes) => request('PATCH','designs',id,select(changes,fields)),
    duplicate: (design,title) => request('POST','designs',null,{...select(design,fields),title}),
    listElements: () => tableRequest('clutch_app_elements','GET'),
    createElement: element => tableRequest('clutch_app_elements','POST',null,select(element,elementFields)),
    updateElement: (id,changes) => tableRequest('clutch_app_elements','PATCH',id,select(changes,elementFields)),
    memberLabels: () => tableRequest('clutch_app_member_labels','GET')
  };
}
