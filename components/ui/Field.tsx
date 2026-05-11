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
      <label className="mb-2 block text-sm font-black text-slate-950">
        {label}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full min-w-0 rounded-[20px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10"
      />
    </div>
  );
}
