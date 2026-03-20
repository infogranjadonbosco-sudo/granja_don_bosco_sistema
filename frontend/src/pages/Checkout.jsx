import { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Checkout() {
  const { cart, clearCart, getTotal } = useCart();
  const navigate = useNavigate();
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [cliente, setCliente] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function loadInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      let currentRole = 'cliente';
      if (user) {
        const { data: profile } = await supabase.from('usuarios').select('rol').eq('id', user.id).maybeSingle();
        currentRole = profile?.rol || 'cliente';
      }
      
      const isStaff = currentRole === 'admin' || currentRole === 'colaborador';

      // Aqui cargamos la lista de vendedores (colaboradores y admins)
      const { data: colabs } = await supabase
        .from('usuarios')
        .select('id, nombre_completo')
        .neq('rol', 'cliente')
        .order('nombre_completo');

      setVendedores(colabs || []);

      if (isStaff && user) {
        // Si es trabajador, establecemos el vendedor actual por defecto
        const current = colabs?.find(c => c.id === user.id);
        if (current) setVendedor(current.nombre_completo);
        else setVendedor('Personal Interno');
      } else {
        // Si es cliente/visitante, asignamos un valor genérico automático
        setVendedor('Cliente - Autoservicio');
      }

      setLoading(false);
    }
    loadInitialData();
  }, []);

  const registrarVenta = async () => {
    try {
      if (cart.length === 0) {
        alert("Agregue productos al carrito");
        return;
      }

      const isGuest = !vendedores.some(v => v.nombre_completo === vendedor) && vendedor === 'Cliente - Autoservicio';

      if (!cliente.trim() && !isGuest) {
        alert("⚠️ Por favor, ingrese el nombre del cliente (Es obligatorio)");
        return;
      }

      if (!vendedor) {
        alert("⚠️ Por favor, seleccione un vendedor");
        return;
      }

      const totalVenta = getTotal();
      // Si el cliente está vacío (visitante), tratamos de usar su nombre del perfil o "Cliente Web"
      const nombreFinalCliente = cliente.trim() || (user ? 'Usuario Registrado' : 'Cliente Visitante');

      const { data: orderData, error: orderError } = await supabase.from('orders').insert([{
        total: totalVenta,
        status: 'completado',
        metodo_pago: metodoPago,
        usuario_id: user?.id || null,
        nombre_cliente: nombreFinalCliente,
        vendedor_nombre: vendedor
      }]).select();

      if (orderError) {
        console.error("Error de Supabase:", orderError);
        alert("⚠️ Error de Base de Datos: " + orderError.message);
        return;
      }

      if (!orderData || orderData.length === 0) {
        alert("⚠️ Error: No se recibió confirmación de la orden.");
        return;
      }

      const createdOrder = orderData[0];
      
      const itemsParaInsertar = cart.map(item => ({
        order_id: createdOrder.id,
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: 1,
        subtotal: item.price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsParaInsertar);

      if (itemsError) {
        console.warn("No se pudieron guardar los detalles:", itemsError.message);
      }

      alert(`✅ ${vendedor === 'Cliente - Autoservicio' ? 'Pedido enviado' : 'Venta registrada'} con éxito!\nCódigo: #${createdOrder.id.toString().slice(0, 6)}`);

      clearCart();
      setCliente('');
      navigate('/receipts?id=' + createdOrder.id);

    } catch (err) {
      console.error("Error crítico en JS:", err);
      alert("❌ Error Crítico del Sistema: " + err.message);
    }
  };

  const isStaff = vendedores.some(v => v.id === user?.id) || (vendedor !== 'Cliente - Autoservicio' && vendedor !== '');

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#fdfbc0' }}>Cargando...</div>;
  }

  if (cart.length === 0) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', backgroundColor: '#fdfbc0', minHeight: '100vh' }}>
        <h2 style={{ color: '#1b5e20' }}>EL CARRITO ESTÁ VACÍO</h2>
        <button onClick={() => navigate("/")} style={{ background: '#097912', color: 'white', padding: '15px 30px', borderRadius: '30px', border: 'none', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold' }}>
          VOLVER A LA TIENDA
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', backgroundColor: '#fdfbc0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '30px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#1b5e20', textAlign: 'center', marginBottom: '20px', fontSize: '1.5rem' }}>
          {isStaff ? '📝 Registro de Venta' : '🛒 Confirmar Pedido'}
        </h1>

        <div style={{ marginBottom: '20px' }}>
          {cart.map((item, index) => (
            <div key={index} style={{ backgroundColor: '#E8F5E9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderRadius: '10px', marginBottom: '8px' }}>
              <span style={{ flex: 1, color: '#333', fontSize: '0.9rem' }}>{item.name}</span>
              <span style={{ fontWeight: 'bold', color: '#1b5e20' }}>${item.price.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {isStaff && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>👤 Vendedor:</label>
            <select
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem', boxSizing: 'border-box', backgroundColor: '#f9f9f9' }}
            >
              <option value="">Seleccionar vendedor...</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.nombre_completo}>{v.nombre_completo}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>🛍️ Cliente:</label>
          <input
            type="text"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder={isStaff ? "Escriba nombre del cliente (REQUERIDO)" : "Su nombre (Opcional)"}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #1b5e20', fontSize: '1rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '8px' }}>Método de Pago:</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => setMetodoPago('efectivo')}
              type="button"
              style={{ padding: '12px', borderRadius: '10px', border: '2px solid #1b5e20', background: '#e8f5e9', cursor: 'pointer', fontWeight: 'bold' }}
            >
              💵 Efectivo (Pagar al recibir)
            </button>
            <div style={{
              padding: '12px', borderRadius: '10px', border: '1px dashed #ccc',
              background: '#f9f9f9', color: '#888', textAlign: 'center', fontSize: '0.85rem'
            }}>
              🏦 Transferencia / Tarjeta 💳
              <div style={{ fontWeight: 'bold', fontSize: '0.75rem', marginTop: '2px' }}>(Próximamente)</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '25px', color: '#1b5e20' }}>
          <span>Total:</span>
          <span>${getTotal().toFixed(2)}</span>
        </div>

        <button
          onClick={registrarVenta}
          style={{ background: '#1b5e20', color: 'white', border: 'none', padding: '15px', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', width: '100%', marginBottom: '12px' }}
        >
          {isStaff ? '✅ REGISTRAR VENTA' : '✅ ENVIAR PEDIDO'}
        </button>

        <button
          onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', width: '100%' }}
        >
          + Agregar más productos
        </button>
      </div>
    </div>
  );
}
