import React from 'react';

export function Field({
 label,
 children,
}: {
 label: string;
 children: React.ReactNode;
}) {
 return (
 <div className="field">
 <label>{label}</label>
 {children}
 </div>
 );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
 function Input(props, ref) {
 const { className, ...rest } = props;
 return <input ref={ref} className={className ?? 'input'} {...rest} />;
 },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
 function Textarea(props, ref) {
 const { className, ...rest } = props;
 return <textarea ref={ref} className={className ?? 'textarea'} {...rest} />;
 },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
 function Select(props, ref) {
 const { className, ...rest } = props;
 return <select ref={ref} className={className ?? 'select'} {...rest} />;
 },
);
