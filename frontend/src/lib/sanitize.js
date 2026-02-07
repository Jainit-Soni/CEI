import DOMPurify from 'isomorphic-dompurify';

export const sanitize = (content) => {
    if (typeof content !== 'string') return content;
    return DOMPurify.sanitize(content);
};

export const SafeHTML = ({ html, className = "" }) => {
    const clean = sanitize(html);
    return (
        <div
            className={className}
            dangerouslySetInnerHTML={{ __html: clean }}
        />
    );
};
