import ReactMarkdown from "react-markdown";

export default function MarkdownContent({ children }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown>{children || ""}</ReactMarkdown>
    </div>
  );
}
