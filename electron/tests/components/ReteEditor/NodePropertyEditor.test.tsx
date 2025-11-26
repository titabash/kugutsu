/**
 * NodePropertyEditor Tests
 *
 * Phase 4.2: Property panel for node configuration
 * TDD: Tests for node property editing UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { NodePropertyEditor, type EditableNodeData } from '../../../renderer/components/ReteEditor/NodePropertyEditor';

// ============================================================================
// Test Data
// ============================================================================

const createTestNode = (overrides?: Partial<EditableNodeData>): EditableNodeData => ({
  id: 'test-node-1',
  type: 'engineer',
  label: 'Test Engineer',
  description: 'A test engineer node',
  config: {},
  status: 'idle',
  ...overrides,
});

// ============================================================================
// NodePropertyEditor Tests
// ============================================================================

describe('NodePropertyEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render the property editor container', () => {
      render(<NodePropertyEditor node={createTestNode()} />);

      const editor = document.querySelector('.node-property-editor');
      expect(editor).toBeInTheDocument();
    });

    it('should display node label in header', () => {
      const node = createTestNode({ label: 'My Custom Label' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByText('My Custom Label')).toBeInTheDocument();
    });

    it('should display node type in header', () => {
      const node = createTestNode({ type: 'reviewer' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('should display node icon based on type', () => {
      const node = createTestNode({ type: 'engineer' });
      render(<NodePropertyEditor node={node} />);

      // Engineer node should show engineer icon
      expect(screen.getByText('👨‍💻')).toBeInTheDocument();
    });

    it('should not render when collapsed', () => {
      render(<NodePropertyEditor node={createTestNode()} collapsed={true} />);

      const editor = document.querySelector('.node-property-editor');
      expect(editor).not.toBeInTheDocument();
    });

    it('should not render when node is null', () => {
      render(<NodePropertyEditor node={null} />);

      const editor = document.querySelector('.node-property-editor');
      expect(editor).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<NodePropertyEditor node={createTestNode()} className="custom-class" />);

      const editor = document.querySelector('.node-property-editor.custom-class');
      expect(editor).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Basic Properties Tests
  // ==========================================================================

  describe('Basic Properties', () => {
    it('should display label input field', () => {
      render(<NodePropertyEditor node={createTestNode()} />);

      expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
    });

    it('should display description textarea', () => {
      render(<NodePropertyEditor node={createTestNode()} />);

      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should display node ID as read-only', () => {
      const node = createTestNode({ id: 'unique-id-123' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByText('unique-id-123')).toBeInTheDocument();
    });

    it('should call onNodeUpdate when label changes', async () => {
      const user = userEvent.setup();
      const onNodeUpdate = vi.fn();
      const node = createTestNode({ label: 'Original' });

      render(<NodePropertyEditor node={node} onNodeUpdate={onNodeUpdate} />);

      const labelInput = screen.getByLabelText(/label/i);
      await user.clear(labelInput);
      await user.type(labelInput, 'New Label');

      expect(onNodeUpdate).toHaveBeenCalled();
      expect(onNodeUpdate).toHaveBeenCalledWith('test-node-1', expect.objectContaining({ label: expect.any(String) }));
    });

    it('should call onNodeUpdate when description changes', async () => {
      const user = userEvent.setup();
      const onNodeUpdate = vi.fn();
      const node = createTestNode();

      render(<NodePropertyEditor node={node} onNodeUpdate={onNodeUpdate} />);

      const descInput = screen.getByLabelText(/description/i);
      await user.type(descInput, 'New description');

      expect(onNodeUpdate).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // AI Node Configuration Tests
  // ==========================================================================

  describe('AI Node Configuration', () => {
    it('should show AI config for engineer nodes', () => {
      const node = createTestNode({ type: 'engineer' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/max turns/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
    });

    it('should show AI config for reviewer nodes', () => {
      const node = createTestNode({ type: 'reviewer' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();
    });

    it('should show AI config for product-owner nodes', () => {
      const node = createTestNode({ type: 'product-owner' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();
    });

    it('should show AI config for custom-ai nodes', () => {
      const node = createTestNode({ type: 'custom-ai' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();
    });

    it('should display AI provider options', () => {
      const node = createTestNode({ type: 'engineer' });
      render(<NodePropertyEditor node={node} />);

      const providerSelect = screen.getByLabelText(/ai provider/i);
      expect(providerSelect).toBeInTheDocument();

      // Check for options
      const options = providerSelect.querySelectorAll('option');
      const optionValues = Array.from(options).map((o) => o.value);
      expect(optionValues).toContain('claude');
      expect(optionValues).toContain('openai');
      expect(optionValues).toContain('gemini');
    });

    it('should update AI provider on selection', async () => {
      const user = userEvent.setup();
      const onNodeUpdate = vi.fn();
      const node = createTestNode({ type: 'engineer', config: { ai: { provider: 'claude' } } });

      render(<NodePropertyEditor node={node} onNodeUpdate={onNodeUpdate} />);

      const providerSelect = screen.getByLabelText(/ai provider/i);
      await user.selectOptions(providerSelect, 'openai');

      expect(onNodeUpdate).toHaveBeenCalled();
    });

    it('should update maxTurns', async () => {
      const user = userEvent.setup();
      const onNodeUpdate = vi.fn();
      const node = createTestNode({ type: 'engineer' });

      render(<NodePropertyEditor node={node} onNodeUpdate={onNodeUpdate} />);

      const maxTurnsInput = screen.getByLabelText(/max turns/i);
      await user.clear(maxTurnsInput);
      await user.type(maxTurnsInput, '50');

      expect(onNodeUpdate).toHaveBeenCalled();
    });

    it('should update system prompt', async () => {
      const user = userEvent.setup();
      const onNodeUpdate = vi.fn();
      const node = createTestNode({ type: 'engineer' });

      render(<NodePropertyEditor node={node} onNodeUpdate={onNodeUpdate} />);

      const promptInput = screen.getByLabelText(/system prompt/i);
      await user.type(promptInput, 'Custom prompt');

      expect(onNodeUpdate).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Decision Node Configuration Tests
  // ==========================================================================

  describe('Decision Node Configuration', () => {
    it('should show condition editor for decision nodes', () => {
      const node = createTestNode({ type: 'decision' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByLabelText(/condition expression/i)).toBeInTheDocument();
    });

    it('should not show AI config for decision nodes', () => {
      const node = createTestNode({ type: 'decision' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.queryByLabelText(/ai provider/i)).not.toBeInTheDocument();
    });

    it('should update condition expression', async () => {
      const user = userEvent.setup();
      const onNodeUpdate = vi.fn();
      const node = createTestNode({ type: 'decision' });

      render(<NodePropertyEditor node={node} onNodeUpdate={onNodeUpdate} />);

      const conditionInput = screen.getByLabelText(/condition expression/i);
      await user.type(conditionInput, 'input.value > 10');

      expect(onNodeUpdate).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Transform Node Configuration Tests
  // ==========================================================================

  describe('Transform Node Configuration', () => {
    it('should show transform type selector', () => {
      const node = createTestNode({ type: 'transform' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByLabelText(/transform type/i)).toBeInTheDocument();
    });

    it('should show transform function editor', () => {
      const node = createTestNode({ type: 'transform' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByLabelText(/transform function/i)).toBeInTheDocument();
    });

    it('should display transform type options', () => {
      const node = createTestNode({ type: 'transform' });
      render(<NodePropertyEditor node={node} />);

      const typeSelect = screen.getByLabelText(/transform type/i);
      const options = typeSelect.querySelectorAll('option');
      const optionValues = Array.from(options).map((o) => o.value);

      expect(optionValues).toContain('custom');
      expect(optionValues).toContain('map');
      expect(optionValues).toContain('filter');
      expect(optionValues).toContain('reduce');
    });
  });

  // ==========================================================================
  // Control Nodes (No Config)
  // ==========================================================================

  describe('Control Nodes', () => {
    it('should not show special config for start nodes', () => {
      const node = createTestNode({ type: 'start' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.queryByLabelText(/ai provider/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/condition/i)).not.toBeInTheDocument();
    });

    it('should not show special config for end nodes', () => {
      const node = createTestNode({ type: 'end' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.queryByLabelText(/ai provider/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Close Button Tests
  // ==========================================================================

  describe('Close Button', () => {
    it('should render close button', () => {
      render(<NodePropertyEditor node={createTestNode()} />);

      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<NodePropertyEditor node={createTestNode()} onClose={onClose} />);

      const closeButton = screen.getByText('✕');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Status Display Tests
  // ==========================================================================

  describe('Status Display', () => {
    it('should not show status for idle nodes', () => {
      const node = createTestNode({ status: 'idle' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.queryByText(/status:/i)).not.toBeInTheDocument();
    });

    it('should show status for executing nodes', () => {
      const node = createTestNode({ status: 'executing' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByText(/status: executing/i)).toBeInTheDocument();
    });

    it('should show status for completed nodes', () => {
      const node = createTestNode({ status: 'completed' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByText(/status: completed/i)).toBeInTheDocument();
    });

    it('should show status for error nodes', () => {
      const node = createTestNode({ status: 'error' });
      render(<NodePropertyEditor node={node} />);

      expect(screen.getByText(/status: error/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Node Switching Tests
  // ==========================================================================

  describe('Node Switching', () => {
    it('should update display when node prop changes', () => {
      const node1 = createTestNode({ id: 'node-1', label: 'Node 1' });
      const node2 = createTestNode({ id: 'node-2', label: 'Node 2' });

      const { rerender } = render(<NodePropertyEditor node={node1} />);
      expect(screen.getByText('Node 1')).toBeInTheDocument();

      rerender(<NodePropertyEditor node={node2} />);
      expect(screen.getByText('Node 2')).toBeInTheDocument();
    });

    it('should update config editor when node type changes', () => {
      const engineerNode = createTestNode({ type: 'engineer' });
      const decisionNode = createTestNode({ type: 'decision' });

      const { rerender } = render(<NodePropertyEditor node={engineerNode} />);
      expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();

      rerender(<NodePropertyEditor node={decisionNode} />);
      expect(screen.queryByLabelText(/ai provider/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/condition expression/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have accessible labels for all inputs', () => {
      const node = createTestNode({ type: 'engineer' });
      render(<NodePropertyEditor node={node} />);

      // All inputs should have labels
      expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/max turns/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
    });
  });
});
