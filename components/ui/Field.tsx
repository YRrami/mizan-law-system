type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
};

export default function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: FieldProps) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-black text-black">
        {label}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full min-w-0 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-semibold text-black outline-none transition placeholder:text-zinc-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
      />
    </div>
  );
}