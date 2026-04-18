export function BackgroundDecoration() {
  return (
    <div className="absolute inset-0 opacity-30">
      <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-bl from-primary/10 to-primary/0 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-primary/5 to-primary/0 rounded-full blur-3xl" />
    </div>
  );
}
