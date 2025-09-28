import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

export default function TipTapEmailEditor({ value, onChange, className }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: { keepMarks: true }, orderedList: { keepMarks: true } }),
      Link.configure({ openOnClick: false }),
    ],
    content: value || "<p>Bonjour {{prenom}},</p><p>…</p>",
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none focus:outline-none" },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && typeof value === "string" && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-2">
        <button className="px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => editor.chain().focus().toggleBold().run()}
        ><b>B</b></button>
        <button className="px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        ><i>I</i></button>
        <button className="px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >• Liste</button>
        <button className="px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >1. Liste</button>
        <button className="px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => {
            const url = prompt("Lien (https://…)", "https://");
            if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >🔗 Lien</button>
        <button className="px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >❌ Lien</button>
      </div>
      <div className="min-h-[180px] p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
