import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

export default function Cart() {
  const { cart, removeFromCart, clearCart, getTotal } = useCart();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', backgroundColor: '#fdfbc0', minHeight: '100vh' }}>
        <h2 style={{ color: '#1b5e20' }}>EL CARRITO ESTÁ VACÍO</h2>
        <p style={{ color: '#666' }}>Agrega productos desde el catálogo para comenzar.</p>
        <button onClick={() => window.history.back()} style={{ background: '#097912', color: 'white', padding: '15px 30px', borderRadius: '30px', border: 'none', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold' }}>
          VOLVER AL CATÁLOGO
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', backgroundColor: '#fdfbc0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: '30px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#1b5e20', textAlign: 'center', marginBottom: '30px' }}>🛒 Mi Carrito</h1>

        <div style={{ marginBottom: '30px' }}>
          {cart.map((item, index) => (
            <div key={index} style={{ backgroundColor: '#FADADD', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderRadius: '18px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#333' }}>{item.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>{item.presentation}</p>
              </div>
              <p style={{ margin: '0 15px 0 0', fontWeight: 'bold', color: '#1b5e20' }}>${item.price.toFixed(2)}</p>
              <button
                onClick={() => removeFromCart(index)}
                style={{ background: '#ff4444', color: 'white', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '2px solid #fdfbc0', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '30px', color: '#1b5e20' }}>
            <span>TOTAL:</span>
            <span>${getTotal().toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <button
              onClick={() => navigate('/checkout')}
              style={{ background: '#097912', color: 'white', border: 'none', padding: '18px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}
            >
              PROCEDER AL PAGO →
            </button>

            <button
              onClick={() => { if (window.confirm("¿Deseas vaciar el carrito?")) clearCart(); }}
              style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
            >
              Vaciar carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
