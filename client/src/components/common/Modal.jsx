// src/components/common/Modal.jsx
import React from 'react';

/**
 * Reusable Modal Component
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Controls whether the modal is visible.
 * @param {function} props.onClose - Function to call when the modal should be closed (e.g., clicking backdrop or close button).
 * @param {string} [props.title] - Optional title for the modal header.
 * @param {React.ReactNode} props.children - Content to display inside the modal body.
 * @param {React.ReactNode} [props.footer] - Optional content for the modal footer (e.g., action buttons).
 * @param {string} [props.modalClassName] - Optional additional class name for the modal-content div.
 */
const Modal = ({ isOpen, onClose, title, children, footer, modalClassName = '' }) => {
  if (!isOpen) {
    return null;
  }

  // Handle clicks on the backdrop to close the modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    // Use the existing modal CSS class
    <div className="modal show" onClick={handleBackdropClick}>
      {/* Add any custom class name */}
      <div className={`modal-content ${modalClassName}`}>
        {/* Only render header if title exists */}
        {title && (
          <div className="modal-header">
            <h4>{title}</h4>
            {/* Use the existing close button style */}
            <button className="close-modal" onClick={onClose}>&times;</button>
          </div>
        )}

        {/* Render the main content */}
        <div className="modal-body">
          {children}
        </div>

        {/* Only render footer if footer content exists */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;