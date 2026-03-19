export default function Page() {
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <iframe
        src="https://polo-x.vercel.app"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
        title="Polo"
      />
    </div>
  );
}
