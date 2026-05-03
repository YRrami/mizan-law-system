type TextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export default function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: TextareaFieldProps) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-black text-black">{label}</label>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 resize-none rounded-[20px] border border-black/10 bg-white/80 p-4 text-sm font-semibold leading-7 text-black outline-none transition placeholder:text-zinc-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
      />
    </div>
  );
}