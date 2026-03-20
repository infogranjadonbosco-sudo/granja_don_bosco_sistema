import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function InventoryAlerts() {
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [perfil, setPerfil] = useState(null);

    useEffect(() => {
        loadLowStock();
        fetchPerfil();
    }, []);

    const fetchPerfil = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle();
            setPerfil(data);
        }
    };

    const isAdmin = perfil?.rol === 'admin';

    const loadLowStock = async () => {
        const { data } = await supabase
            .from("products")
            .select("*")
            .lt("stock", 10)
            .eq("deleted", false)
            .order('stock', { ascending: true });

        setLowStockProducts(data || []);
        setLoading(false);
    };

    return (
        <div style={{ padding: '30px', backgroundColor: '#fdfbc0', minHeight: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
                <span style={{ fontSize: '2.5rem' }}>🚨</span>
                <div>
                    <h1 style={{ color: '#d32f2f', margin: 0 }}>Alertas de Disponibilidad</h1>
                    <p style={{ color: '#666', margin: 0 }}>
                        {isAdmin 
                            ? "Productos con menos de 10 unidades. Por favor, gestione el reabastecimiento." 
                            : "Productos con disponibilidad crítica. Por favor, notifique al administrador."}
                    </p>
                </div>
            </div>

            {loading ? (
                <p>Cargando alertas...</p>
            ) : lowStockProducts.length > 0 ? (
                <div style={styles.tableCard}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>Producto</th>
                                <th style={styles.th}>Disponibilidad</th>
                                <th style={styles.th}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lowStockProducts.map((p) => (
                                <tr key={p.id} style={styles.tr}>
                                    <td style={styles.td}><b>{p.name}</b></td>
                                    <td style={{ ...styles.td, color: '#d32f2f', fontWeight: 'bold' }}>{p.stock} unidades</td>
                                    <td style={styles.td}>
                                        <span style={styles.badge}>REABASTECER URGENTE</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '50px', backgroundColor: 'white', borderRadius: '15px' }}>
                    <span style={{ fontSize: '3rem' }}>✅</span>
                    <h3 style={{ color: '#2e7d32' }}>¡Todo en orden!</h3>
                    <p>No hay productos con disponibilidad crítica en este momento.</p>
                </div>
            )}
        </div>
    );
}

const styles = {
    tableCard: {
        background: 'white',
        padding: '20px',
        borderRadius: '15px',
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
    },
    table: { width: '100%', borderCollapse: 'collapse' },
    tableHeader: { borderBottom: '2px solid #ffcdd2', textAlign: 'left' },
    th: { padding: '12px', color: '#666', fontSize: '0.9rem' },
    td: { padding: '15px 12px', borderBottom: '1px solid #f9f9f9', color: '#333' },
    tr: { transition: 'background 0.2s' },
    badge: {
        backgroundColor: '#ffebee',
        color: '#d32f2f',
        padding: '4px 10px',
        borderRadius: '10px',
        fontSize: '0.75rem',
        fontWeight: 'bold'
    }
};
