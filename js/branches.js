/**
 * branches.js
 * ------------------------------------------------------------------
 * Manajemen data cabang (multi-cabang).
 * ------------------------------------------------------------------
 */

const Branches = (() => {

  function getAll() {
    return DB.get('branches');
  }

  function getById(id) {
    return DB.find('branches', id);
  }

  function create({ name, address, whatsapp, headName }) {
    if (!name) return { success: false, message: 'Nama cabang wajib diisi.' };
    const branch = DB.insert('branches', {
      id: DB.genId('branches'), name, address: address || '', whatsapp: whatsapp || '',
      headName: headName || '', status: 'aktif'
    });
    return { success: true, branch };
  }

  function update(id, patch) {
    const updated = DB.update('branches', id, patch);
    return updated ? { success: true, branch: updated } : { success: false, message: 'Cabang tidak ditemukan.' };
  }

  function remove(id) {
    return DB.delete('branches', id);
  }

  function getActive() {
    return getAll().filter(b => b.status === 'aktif');
  }

  return { getAll, getById, create, update, remove, getActive };
})();
