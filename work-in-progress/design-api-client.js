// Experimental client, not yet connected to the prototype editor.
// Never expose a service-role key in browser code.
export function createDesignClient({ accessToken, publicKey }) {
  if (!accessToken || !publicKey) throw new Error('User session and public API key required');
  const endpoint = 'https://fgnuaxhujvxkfzzcvdqf.supabase.co/functions/v1/admin-clutch-designs';
  const fields = ['title', 'garment', 'drop_label', 'piece_label', 'canvas'];
  const select = value => Object.fromEntries(fields.filter(k => Object.hasOwn(value,k)).map(k => [k,value[k]]));
  async function request(method, resource, id, value) {
    const url = new URL(endpoint);
    url.searchParams.set('resource', resource);
    if (id) url.searchParams.set('id', id);
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, apikey: publicKey, 'Content-Type': 'application/json' }, ...(value === undefined ? {} : {body: JSON.stringify(value)}), cache: 'no-store' });
    let data;
    try { data = await response.json(); } catch { throw new Error('Invalid server response'); }
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }
  return {
    list: () => request('GET','designs'),
    revisions: id => request('GET','revisions',id),
    create: design => request('POST','designs',null,select(design)),
    update: (id,changes) => request('PATCH','designs',id,select(changes)),
    duplicate: (design,title) => request('POST','designs',null,{...select(design),title})
  };
}
