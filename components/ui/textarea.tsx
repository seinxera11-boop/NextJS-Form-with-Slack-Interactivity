import * as React from "react";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>((props, ref) => {
  return <textarea ref={ref} {...props} className="border p-2 rounded w-full" />;
});

Textarea.displayName = "Textarea";