import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
    Bold, Italic, Strikethrough, Heading2, Heading3,
    List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
    Undo, Redo, Quote, Code
} from 'lucide-react';
import { useCallback, useEffect, type ReactNode } from 'react';

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    onImageUpload?: (file: File, callback: (url: string) => void) => void;
}

/** Только http(s), mailto и относительные пути: javascript: и data: в ссылках и картинках не пропускаем. */
function isSafeUrl(url: string, { allowMailto = false } = {}): boolean {
    const value = url.trim();
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:' || (allowMailto && protocol === 'mailto:');
    } catch {
        return false;
    }
}

interface ToolbarButtonProps {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: ReactNode;
}

// Вынесен из MenuBar: компонент, объявленный внутри рендера, пересоздавался на каждый
// рендер (React размонтировал и заново монтировал все кнопки панели).
function ToolbarButton({ onClick, isActive = false, disabled = false, children, title }: ToolbarButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            aria-pressed={isActive}
            type="button"
            className={`p-1.5 rounded transition-colors ${
                isActive ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
            } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {children}
        </button>
    );
}

function MenuBar({ editor, onImageUpload }: { editor: Editor | null; onImageUpload?: RichTextEditorProps['onImageUpload'] }) {
    // Все хуки вызываются до раннего return: иначе порядок хуков менялся бы между рендерами.
    const addImage = useCallback(() => {
        if (!editor) return;
        if (!onImageUpload) {
            const url = window.prompt('URL of the image:');
            if (url && isSafeUrl(url)) {
                editor.chain().focus().setImage({ src: url.trim() }).run();
            } else if (url) {
                window.alert('Допустимы только ссылки http(s) или относительные пути.');
            }
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            if (input.files?.length) {
                onImageUpload(input.files[0], (url) => {
                    editor.chain().focus().setImage({ src: url }).run();
                });
            }
        };
        input.click();
    }, [editor, onImageUpload]);

    const setLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL:', previousUrl);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        if (!isSafeUrl(url, { allowMailto: true })) {
            window.alert('Допустимы только ссылки http(s), mailto или относительные пути.');
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    }, [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-black/50 border-b border-white/10 rounded-t-lg" role="toolbar" aria-label="Форматирование">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
                <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
                <Italic className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
                <Strikethrough className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">
                <Code className="w-4 h-4" />
            </ToolbarButton>

            <div className="w-[1px] h-4 bg-white/20 mx-1" />

            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
                <Heading2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3">
                <Heading3 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
                <List className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List">
                <ListOrdered className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
                <Quote className="w-4 h-4" />
            </ToolbarButton>

            <div className="w-[1px] h-4 bg-white/20 mx-1" />

            <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title="Link">
                <LinkIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={addImage} title="Image">
                <ImageIcon className="w-4 h-4" />
            </ToolbarButton>

            <div className="w-[1px] h-4 bg-white/20 mx-1" />

            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                <Undo className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                <Redo className="w-4 h-4" />
            </ToolbarButton>
        </div>
    );
}

export default function RichTextEditor({ content, onChange, onImageUpload }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-400 hover:underline',
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full my-4 border border-white/10',
                },
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-p:text-[#aaa] prose-headings:text-white prose-a:text-blue-400 max-w-none min-h-[300px] p-4 outline-none',
            },
        },
    });

    // Handle updates from external (like loading a draft)
    useEffect(() => {
        if (editor && content !== editor.getHTML() && !editor.isFocused) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    return (
        <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden focus-within:border-white/30 transition-colors">
            <MenuBar editor={editor} onImageUpload={onImageUpload} />
            <div className="bg-transparent text-sm leading-relaxed overflow-y-auto max-h-[600px] custom-scrollbar">
                <EditorContent editor={editor} />
            </div>

            <style>{`
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: rgba(255, 255, 255, 0.3);
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
}
