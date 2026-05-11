type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
};

export default function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: SelectFieldProps) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-black text-slate-950">{label}</label>
      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full min-w-0 rounded-[20px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
