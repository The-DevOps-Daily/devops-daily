export function BackgroundDecoration() {
  return (
    <div className="absolute inset-0 opacity-30">
      <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-bl from-primary/5 to-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-blue-500/5 to-primary/5 rounded-full blur-3xl" />
    </div>
  );
}
