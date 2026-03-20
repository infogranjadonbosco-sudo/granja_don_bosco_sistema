import { useEffect, useState, useRef } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const images = import.meta.glob("../assets/*.{png,jpg,jpeg,PNG,JPG,JPEG}", { eager: true });

function ProductCard({ product, navigate, canEdit, isAdmin, onRefresh, onEdit, onAddStock }) {
  const [isHovered, setIsHovered] = useState(false);

  const getProductImage = () => {
    // Si el producto tiene imagen propia, la usamos; si no, buscamos en la carpeta de assets
    if (product.image_url) return product.image_url;

    const name = product.name.toLowerCase().trim();
    const firstWord = name.split(' ')[0].replace(/[()]/g, '');
    return images[`../assets/${name}.jpg`]?.default ||
      images[`../assets/${firstWord}.jpg`]?.default ||
      images[`../assets/${name}.png`]?.default ||
      'https://via.placeholder.com/150?text=Sin+Imagen';
  };

  const eliminarProducto = async (e) => {
    e.stopPropagation();
    const isTrash = product.deleted === true;
    const confirmMsg = isTrash 
      ? `¿Estás seguro de eliminar PERMANENTEMENTE "${product.name}"? Esta acción no se puede deshacer.`
      : `¿Enviar "${product.name}" a la papelera?`;

    if (window.confirm(confirmMsg)) {
      if (isTrash) {
        // Eliminar permanente
        const { error } = await supabase.from("products").delete().eq("id", product.id);
        if (!error) onRefresh();
      } else {
        // Mover a papelera
        const { error } = await supabase.from("products").update({ deleted: true }).eq("id", product.id);
        if (!error) onRefresh();
      }
    }
  };

  const restaurarProducto = async (e) => {
    e.stopPropagation();
    const { error } = await supabase.from("products").update({ deleted: false }).eq("id", product.id);
    if (!error) onRefresh();
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(product);
  };

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: '#FADADD',
        minWidth: '220px',
        width: '220px',
        borderRadius: '15px',
        padding: '20px',
        boxShadow: isHovered ? '0 12px 20px rgba(0,0,0,0.2)' : '0 4px 15px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        textAlign: 'center',
        flexShrink: 0,
        transform: isHovered ? 'translateY(-10px)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        scrollSnapAlign: 'start'
      }}
    >
      <div style={{
        width: '100%', height: '140px', marginBottom: '15px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden'
      }}>
        <img
          src={getProductImage()}
          alt={product.name}
          style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
        />
      </div>

      <h4 style={{ fontSize: '0.9rem', height: '40px', margin: '10px 0', color: '#333', overflow: 'hidden' }}>
        {product.name}
      </h4>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
        <p style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1b5e20', margin: 0 }}>
          ${parseFloat(product.price).toFixed(2)}
        </p>
        {(canEdit || isAdmin) && (
          <button onClick={handleEdit} style={{ border: 'none', background: '#1b5e20', color: 'white', borderRadius: '5px', cursor: 'pointer', padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ✏️ Editar
          </button>
        )}
        {isAdmin && (
          <>
            {!product.deleted && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAddStock(product); }} 
                style={{ border: 'none', background: '#2e7d32', color: 'white', borderRadius: '5px', cursor: 'pointer', padding: '5px 8px', fontSize: '0.8rem' }}
                title="Sumar Stock"
              >
                📦 +
              </button>
            )}
            {product.deleted && (
              <button 
                onClick={restaurarProducto} 
                style={{ border: 'none', background: '#1b5e20', color: 'white', borderRadius: '5px', cursor: 'pointer', padding: '5px 8px', fontSize: '0.8rem' }}
                title="Restaurar"
              >
                ♻️
              </button>
            )}
            <button onClick={eliminarProducto} style={{ border: 'none', background: '#d32f2f', color: 'white', borderRadius: '5px', cursor: 'pointer', padding: '5px', fontSize: '0.8rem' }} title={product.deleted ? "Eliminar Permanente" : "Mover a Papelera"}>
              🗑️
            </button>
          </>
        )}
      </div>

      <button style={{ backgroundColor: '#097912', color: 'white', border: 'none', width: '100%', padding: '10px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
        Ver Opciones
      </button>
    </div>
  );
}

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [trashProducts, setTrashProducts] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [canAdd, setCanAdd] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Variables para el formulario de agregar/editar productos
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock: "0",
    category: "",
    image_url: "",
    unidad_medida: "Unidades"
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Modal para sumar stock rápido
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockToAdd, setStockToAdd] = useState(0);
  const [selectedProductStock, setSelectedProductStock] = useState(null);

  useEffect(() => {
    fetchProducts();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: perfil } = await supabase.from("usuarios")
      .select("rol, puede_editar, puede_eliminar, puede_agregar")
      .eq("id", user.id).maybeSingle();

    if (perfil) {
      const isSuper = perfil.rol === 'admin';
      setIsAdmin(isSuper);
      setCanEdit(isSuper || perfil.puede_editar);
      setCanAdd(isSuper || perfil.puede_agregar);
      setCanDelete(isSuper || perfil.puede_eliminar);
    }
  };

  const fetchProducts = async () => {
    const { data: active, error: err1 } = await supabase.from("products").select("*").eq('deleted', false).order('name');
    const { data: deleted, error: err2 } = await supabase.from("products").select("*").eq('deleted', true).order('name');
    
    if (!err1) setProducts(active);
    if (!err2) setTrashProducts(deleted);
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: "", price: "", stock: "0", category: "", image_url: "", unidad_medida: "Unidades" });
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category || "",
      image_url: product.image_url || "",
      unidad_medida: product.unidad_medida || "Unidades"
    });
    setShowModal(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    try {
      // Subimos la imagen al storage de Supabase
      const { error: uploadError, data } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      alert("¡Imagen subida con éxito! ✅");
    } catch (error) {
      alert("Error al subir imagen. Asegúrate de que el bucket 'productos' sea público en Supabase. " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      category: formData.category,
      image_url: formData.image_url,
      unidad_medida: formData.unidad_medida 
    };

    let error;
    if (editingProduct) {
      const { error: err } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("products").insert([payload]);
      error = err;
    }

    if (!error) {
      setShowModal(false);
      fetchProducts();
      alert("¡Guardado correctamente! ✅");
    } else {
      console.error("Error Supabase:", error);
      if (error.message.includes("unidad_medida") || error.message.includes("image_url")) {
        alert("⚠️ Error de base de datos: Faltan columnas en la tabla de productos. Por favor, ejecuta el script 'database_optimizer.sql' en tu editor SQL de Supabase para solucionarlo.");
      } else {
        alert("❌ Error al guardar: " + error.message);
      }
    }
  };

  const openAddStockModal = (product) => {
    setSelectedProductStock(product);
    setStockToAdd(0);
    setShowStockModal(true);
  };

  const handleQuickStockUpdate = async () => {
    if (!selectedProductStock || stockToAdd === 0) return;
    
    const nuevoStock = selectedProductStock.stock + parseInt(stockToAdd);
    const { error } = await supabase
      .from("products")
      .update({ stock: nuevoStock })
      .eq("id", selectedProductStock.id);

    if (!error) {
      setShowStockModal(false);
      fetchProducts();
      alert(`✅ Stock de ${selectedProductStock.name} actualizado a ${nuevoStock}`);
    } else {
      alert("Error al actualizar stock: " + error.message);
    }
  };

  const obtenerSeccion = (nombre) => {
    const n = nombre.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (n.includes('pavo') || n.includes('conejo') || n.includes('gallina') || n.includes('pato')) return "ANIMALES";
    if (n.includes('huevo') || n.includes('miel')) return "OTROS ALIMENTOS";
    if (n.includes('vacuna') || n.includes('dosis') || n.includes('ml') || n.includes('rabia')) return "VACUNAS Y MEDICINA";
    if (n.includes('leche') || n.includes('requeson') || n.includes('queso') || n.includes('crema') || n.includes('cuajada')) return "LÁCTEOS";
    if (n.includes('pollo') || n.includes('menudo')) return "PRODUCTOS DE POLLO";
    if (n.includes('carne') || n.includes('res') || n.includes('cerdo')) return "CARNES";
    if (n.includes('concentrado') || n.includes('alimento')) return "CONCENTRADOS";
    return "OTROS PRODUCTOS";
  };

  const categorias = products.reduce((acc, product) => {
    const seccion = product.category || obtenerSeccion(product.name);
    if (!acc[seccion]) acc[seccion] = [];
    acc[seccion].push(product);
    return acc;
  }, {});

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#fdfbc0', minHeight: '100vh' }}>Cargando tienda...</div>;

  return (
    <div style={{ padding: '20px 40px', backgroundColor: '#fdfbc0', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ color: '#1b5e20', margin: 0 }}>🛍️ Tienda de la Granja</h1>
          {isAdmin && (
            <span style={{ fontSize: '0.8rem', color: '#2e7d32', fontWeight: 'bold', background: '#e8f5e9', padding: '4px 10px', borderRadius: '10px', marginTop: '5px', display: 'inline-block' }}>
              ⚙️ MODO ADMINISTRADOR ACTIVO
            </span>
          )}
        </div>
        {canAdd && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {isAdmin && (
              <button 
                onClick={() => setShowTrash(!showTrash)} 
                style={{ 
                  backgroundColor: showTrash ? '#333' : '#757575', 
                  color: 'white', border: 'none', padding: '12px 25px', borderRadius: '25px', 
                  fontWeight: 'bold', cursor: 'pointer' 
                }}
              >
                {showTrash ? '📦 Ver Tienda' : `🗑️ Papelera (${trashProducts.length})`}
              </button>
            )}
            <button onClick={openAddModal} style={{ backgroundColor: '#1b5e20', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
              + AGREGAR PRODUCTO
            </button>
          </div>
        )}
      </div>

      {showTrash && isAdmin ? (
        <section>
          <h2 style={{ color: '#d32f2f', borderBottom: '3px solid #d32f2f', display: 'inline-block', marginBottom: '25px', fontSize: '1.6rem' }}>
            🗑️ PRODUCTOS EN LA PAPELERA
          </h2>
          {trashProducts.length === 0 ? (
            <p style={{ color: '#888' }}>La papelera está vacía.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
              {trashProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  navigate={() => {}} // No navegar si está en papelera
                  canEdit={false}
                  isAdmin={true}
                  onRefresh={fetchProducts}
                  onEdit={() => {}}
                  onAddStock={() => {}}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        Object.keys(categorias).sort().map((titulo) => (
          <section key={titulo} style={{ marginBottom: '60px', paddingBottom: '10px' }}>
            <h2 style={{
              color: '#1b5e20', borderBottom: '3px solid #1b5e20', display: 'inline-block', marginBottom: '25px', fontSize: '1.6rem', textTransform: 'uppercase', whiteSpace: 'nowrap'
            }}>
              {titulo}
            </h2>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              overflowX: 'auto',
              gap: '24px',
              paddingBottom: '30px',
              paddingTop: '10px',
              paddingRight: '40px',
              scrollbarWidth: 'thin',
              scrollSnapType: 'x proximity',
              WebkitOverflowScrolling: 'touch'
            }}>
              {categorias[titulo].map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  navigate={navigate}
                  canEdit={canEdit}
                  isAdmin={canDelete}
                  onRefresh={fetchProducts}
                  onEdit={openEditModal}
                  onAddStock={openAddStockModal}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* MODO DE AGREGAR/EDITAR PRODUCTO */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{ color: '#1b5e20', marginTop: 0 }}>{editingProduct ? '📝 Editar Producto' : '✨ Nuevo Producto'}</h2>
            <form onSubmit={handleSaveProduct}>
              <div style={styles.field}>
                <label style={styles.label}>Nombre del Producto</label>
                <input style={styles.input} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Ej: Queso Fresco Especial" />
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Precio ($)</label>
                  <input type="number" step="0.01" style={styles.input} value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Disponibilidad (Stock)</label>
                  <input type="number" style={styles.input} value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Categoría</label>
                  <select style={styles.input} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                    <option value="">-- Seleccionar --</option>
                    <option value="LÁCTEOS">LÁCTEOS</option>
                    <option value="CARNES">CARNES</option>
                    <option value="PRODUCTOS DE POLLO">PRODUCTOS DE POLLO</option>
                    <option value="ANIMALES">ANIMALES</option>
                    <option value="OTROS ALIMENTOS">OTROS ALIMENTOS</option>
                    <option value="VACUNAS Y MEDICINA">VACUNAS Y MEDICINA</option>
                    <option value="CONCENTRADOS">CONCENTRADOS</option>
                    <option value="OTROS PRODUCTOS">OTROS PRODUCTOS</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Unidad de Medida</label>
                  <select style={styles.input} value={formData.unidad_medida} onChange={e => setFormData({ ...formData, unidad_medida: e.target.value })} required>
                    <option value="Unidad">Unidad</option>
                    <option value="Libra">Libra</option>
                    <option value="Onza">Onza</option>
                    <option value="Botella">Botella</option>
                    <option value="Litro">Litro</option>
                    <option value="Galón">Galón</option>
                    <option value="Arroba">Arroba</option>
                    <option value="Quintal">Quintal</option>
                    <option value="Docena">Docena</option>
                    <option value="Cartón">Cartón</option>
                    <option value="Saco">Saco</option>
                    <option value="Dosis">Dosis</option>
                    <option value="Par">Par / Pareja</option>
                    <option value="Bolsa">Bolsa</option>
                    <option value="Un cuarto">Un cuarto</option>
                    <option value="Tamaño">Tamaño</option>
                  </select>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Imagen del Producto</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{
                    width: '60px', height: '60px', background: '#f5f5f5', borderRadius: '10px',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ddd'
                  }}>
                    {formData.image_url ? (
                      <img src={formData.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.2rem' }}>🖼️</span>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*" />
                  <button type="button" onClick={() => fileInputRef.current.click()} style={styles.uploadBtn}>
                    {uploading ? 'Subiendo...' : 'Subir desde dispositivo 📤'}
                  </button>
                  {formData.image_url && (
                    <button type="button" onClick={() => setFormData({ ...formData, image_url: "" })} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '0.8rem' }}>Borrar</button>
                  )}
                </div>
                <p style={{ fontSize: '0.65rem', color: '#888', marginTop: '5px' }}>Si no subes una imagen, se usará la predeterminada por nombre.</p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ ...styles.btn, background: '#eee', color: '#666' }}>Cancelar</button>
                <button type="submit" style={{ ...styles.btn, background: '#1b5e20', color: 'white', flex: 1 }}>{editingProduct ? 'Actualizar' : 'Crear Producto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL PARA SUMAR STOCK RÁPIDO */}
      {showStockModal && selectedProductStock && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '350px' }}>
            <h3 style={{ color: '#1b5e20', marginTop: 0 }}>📦 Abastecer Inventario</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Estás añadiendo stock a: <b>{selectedProductStock.name}</b>
            </p>
            <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' }}>
               <span style={{ fontSize: '0.8rem', color: '#888' }}>Stock Actual:</span>
               <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>{selectedProductStock.stock} {selectedProductStock.unidad_medida}</div>
            </div>
            
            <label style={styles.label}>Cantidad a sumar:</label>
            <input 
              type="number" 
              style={{ ...styles.input, textAlign: 'center', fontSize: '1.2rem' }} 
              value={stockToAdd} 
              onChange={e => setStockToAdd(e.target.value)}
              placeholder="0"
              autoFocus
            />
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button 
                onClick={() => setShowStockModal(false)} 
                style={{ ...styles.btn, background: '#eee', color: '#666', flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleQuickStockUpdate} 
                style={{ ...styles.btn, background: '#1b5e20', color: 'white', flex: 2 }}
                disabled={!stockToAdd || stockToAdd < 0}
              >
                Sumar al Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)'
  },
  modal: {
    background: 'white', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
  },
  field: { marginBottom: '20px' },
  label: { display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '8px', fontWeight: 'bold' },
  input: {
    width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none'
  },
  uploadBtn: {
    backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #2e7d32', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
  },
  btn: {
    padding: '12px 20px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s'
  }
};