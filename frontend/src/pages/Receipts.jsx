import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Receipts() {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderDetails, setOrderDetails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        checkAdmin();
        fetchOrders();
    }, []);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('usuarios').select('rol').eq('id', user.id).single();
            if (data?.rol === 'admin') setIsAdmin(true);
        }
    };

    const handleDeleteOrder = async (orderId) => {
        if (!window.confirm("¿Estás seguro de eliminar este recibo permanentemente?")) return;

        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        
        if (error) {
            alert("Error al eliminar: " + error.message);
        } else {
            alert("✅ Recibo eliminado con éxito");
            setOrders(orders.filter(o => o.id !== orderId));
            setSelectedOrder(null);
        }
    };

    useEffect(() => {
        // Si venimos de la búsqueda global con un ID en el state o query
        const params = new URLSearchParams(location.search);
        const orderId = params.get('id');
        if (orderId && orders.length > 0) {
            const order = orders.find(o => o.id === orderId);
            if (order) handleViewDetails(order);
        }
    }, [location.search, orders]);

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error("Error fetching orders:", error);
        setOrders(data || []);
        setLoading(false);
    };

    const handleViewDetails = async (order) => {
        setSelectedOrder(order);
        const { data, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

        if (!error) setOrderDetails(data || []);
    };

    const filteredOrders = orders.filter(o => 
        o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (o.nombre_cliente && o.nombre_cliente.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) return <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#fdfbc0', minHeight: '100vh' }}>Cargando historial de recibos...</div>;

    return (
        <div style={{ padding: '30px', backgroundColor: '#fdfbc0', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
            {/* Estilos para impresión - Formato de Ticket Térmico */}
            <style>
                {`
                @media print {
                    @page {
                        margin: 0;
                        size: 80mm auto; /* Ajuste para papel térmico estándar */
                    }
                    nav, .navbar-fixed, .no-print, input { 
                        display: none !important; 
                    }
                    body, .main-app-layout, .app-content-area { 
                        background: white !important; 
                        margin: 0;
                        padding: 0;
                    }
                    .printable-receipt { 
                        position: static !important;
                        width: 75mm !important; /* Un poco menos de 80mm para márgenes */
                        margin: 0 auto !important;
                        padding: 10mm 5mm !important;
                        box-shadow: none !important;
                        border: none !important;
                        font-family: 'Courier New', Courier, monospace !important; /* Fuente tipo ticket */
                        color: black !important;
                    }
                    .ticket-header h2 { font-size: 1.2rem !important; margin: 5px 0 !important; }
                    .ticket-header p { font-size: 0.7rem !important; }
                    .ticket-divider { border-top: 1px dashed black !important; margin: 10px 0 !important; }
                    .ticket-table th, .ticket-table td { font-size: 0.75rem !important; padding: 4px 0 !important; }
                    .ticket-total { font-size: 1.1rem !important; border-top: 1px solid black !important; padding-top: 8px !important; }
                }
                `}
            </style>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ color: '#1b5e20', margin: 0 }}>🧾 Historial de Recibos</h1>
                <input 
                    type="text" 
                    placeholder="Buscar por código # o nombre..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '10px 20px', borderRadius: '25px', border: '1px solid #ddd', width: '300px', outline: 'none' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {/* LISTA DE RECIBOS */}
                <div className="no-print" style={{ background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', maxHeight: '70vh', overflowY: 'auto' }}>
                    <h2 style={{ fontSize: '1rem', color: '#1b5e20', marginBottom: '20px', borderBottom: '2px solid #e8f5e9', paddingBottom: '10px' }}>Últimas Ventas</h2>
                    {filteredOrders.map(o => (
                        <div 
                            key={o.id} 
                            onClick={() => handleViewDetails(o)}
                            style={{ 
                                padding: '15px', 
                                borderBottom: '1px solid #f5f5f5', 
                                cursor: 'pointer',
                                backgroundColor: selectedOrder?.id === o.id ? '#e8f5e9' : 'transparent',
                                borderRadius: '10px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ fontWeight: 'bold', color: '#333' }}>#{o.id.toString().slice(0, 8)}</span>
                                <span style={{ fontWeight: 'bold', color: '#1b5e20' }}>${Number(o.total).toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                                <span>👤 {o.nombre_cliente || 'Invitado'}</span>
                                <span>📅 {new Date(o.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* DETALLE DEL RECIBO SELECCIONADO (FORMATO TICKET) */}
                <div className="printable-receipt" style={{ background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', position: 'sticky', top: '20px', height: 'fit-content' }}>
                    {selectedOrder ? (
                        <div style={{ textAlign: 'center' }}>
                            <div className="ticket-header">
                                <div style={{ fontSize: '2.5rem', marginBottom: '5px' }}>🚜</div>
                                <h2 style={{ margin: 0, color: '#1b5e20', textTransform: 'uppercase', letterSpacing: '1px' }}>Granja Don Bosco</h2>
                            </div>

                            <div className="ticket-divider" style={{ borderTop: '1px dashed #ddd', margin: '15px 0' }}></div>
                            
                            <div style={{ textAlign: 'left', fontSize: '0.85rem' }}>
                                <p style={{ margin: '3px 0' }}><b>TICKET:</b> #{selectedOrder.id.toString().slice(0, 8).toUpperCase()}</p>
                                <p style={{ margin: '3px 0' }}><b>FECHA:</b> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                                <p style={{ margin: '3px 0' }}><b>CLIENTE:</b> {selectedOrder.nombre_cliente?.toUpperCase() || 'INVITADO'}</p>
                                <p style={{ margin: '3px 0' }}><b>VENDEDOR:</b> {selectedOrder.vendedor_nombre?.toUpperCase() || 'SISTEMA'}</p>
                            </div>

                            <div className="ticket-divider" style={{ borderTop: '1px dashed #ddd', margin: '15px 0' }}></div>

                            <table className="ticket-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #333' }}>
                                        <th style={{ textAlign: 'left', padding: '5px 0', fontSize: '0.8rem' }}>DESCRIPCIÓN</th>
                                        <th style={{ textAlign: 'center', padding: '5px 0', fontSize: '0.8rem' }}>CANT</th>
                                        <th style={{ textAlign: 'right', padding: '5px 0', fontSize: '0.8rem' }}>SUBT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderDetails.length > 0 ? orderDetails.map((it, idx) => (
                                        <tr key={idx}>
                                            <td style={{ textAlign: 'left', padding: '5px 0', fontSize: '0.8rem' }}>{it.product_name.toUpperCase()}</td>
                                            <td style={{ textAlign: 'center', padding: '5px 0', fontSize: '0.8rem' }}>{it.quantity}</td>
                                            <td style={{ textAlign: 'right', padding: '5px 0', fontSize: '0.8rem' }}>${Number(it.price).toFixed(2)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="3" style={{ padding: '10px', color: '#888', fontSize: '0.75rem', textAlign: 'center' }}>
                                                Detalle no disponible (Venta antigua)
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            <div className="ticket-total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', color: '#000', borderTop: '2px solid #000', paddingTop: '10px' }}>
                                <span>TOTAL:</span>
                                <span>${Number(selectedOrder.total).toFixed(2)}</span>
                            </div>

                            <div style={{ marginTop: '15px', fontSize: '0.8rem', textAlign: 'center' }}>
                                <p style={{ margin: '2px 0' }}>Método de Pago: {selectedOrder.metodo_pago === 'tarjeta' ? 'TARJETA' : 'EFECTIVO'}</p>
                                <div className="ticket-divider" style={{ borderTop: '1px dashed #ddd', margin: '15px 0' }}></div>
                                <p style={{ fontWeight: 'bold', margin: '10px 0' }}>¡GRACIAS POR SU COMPRA! ✨</p>
                                <p style={{ fontSize: '0.65rem', color: '#999' }}>Vuelva pronto a Granja Don Bosco</p>
                            </div>

                            <div className="no-print" style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                                <button 
                                    onClick={() => window.print()}
                                    style={{ flex: 2, background: '#1b5e20', color: 'white', border: 'none', padding: '12px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    🖨️ Imprimir Ticket
                                </button>
                                {isAdmin && (
                                    <button 
                                        onClick={() => handleDeleteOrder(selectedOrder.id)}
                                        style={{ flex: 1, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '12px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        🗑️ Borrar
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-print" style={{ textAlign: 'center', color: '#999', padding: '100px 0' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔍</div>
                            <p>Selecciona una venta de la lista para ver el recibo detallado</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
