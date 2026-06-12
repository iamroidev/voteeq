/** Scannable QR encoding the ticket code for gate check-in */
export default function TicketQrCode({ value, size = 120 }) {
  if (!value) return null;
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&margin=8`;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={`QR code for ticket ${value}`}
      style={{ display: 'block', borderRadius: '6px', background: '#fff' }}
    />
  );
}
