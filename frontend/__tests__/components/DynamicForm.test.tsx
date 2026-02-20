/**
 * DynamicForm Component Tests
 * Test form rendering, validation, and submission
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicForm from '@/components/DynamicForm';

const mockFormSchema = {
  fields: [
    {
      id: 'field-1',
      name: 'door_id',
      type: 'text',
      label: 'Door ID',
      required: true,
    },
    {
      id: 'field-2',
      name: 'fire_class',
      type: 'enum',
      label: 'Fire Class',
      required: true,
      options: ['EI30', 'EI60', 'EI90'],
    },
    {
      id: 'field-3',
      name: 'description',
      type: 'text',
      label: 'Description',
      required: false,
    },
  ],
};

describe('DynamicForm', () => {
  it('renders all form fields', () => {
    const onSubmit = jest.fn();
    render(
      <DynamicForm
        schema={mockFormSchema}
        onSubmit={onSubmit}
        isLoading={false}
      />
    );

    expect(screen.getByLabelText('Door ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire Class')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('shows required field validation errors', async () => {
    const onSubmit = jest.fn();
    render(
      <DynamicForm
        schema={mockFormSchema}
        onSubmit={onSubmit}
        isLoading={false}
      />
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();

    render(
      <DynamicForm
        schema={mockFormSchema}
        onSubmit={onSubmit}
        isLoading={false}
      />
    );

    await user.type(screen.getByLabelText('Door ID'), 'D-001');
    await user.selectOptions(screen.getByLabelText('Fire Class'), 'EI60');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          door_id: 'D-001',
          fire_class: 'EI60',
        })
      );
    });
  });

  it('disables submit button while loading', () => {
    const onSubmit = jest.fn();
    const { rerender } = render(
      <DynamicForm
        schema={mockFormSchema}
        onSubmit={onSubmit}
        isLoading={false}
      />
    );

    const submitButton = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);

    rerender(
      <DynamicForm
        schema={mockFormSchema}
        onSubmit={onSubmit}
        isLoading={true}
      />
    );

    expect(submitButton.disabled).toBe(true);
  });

  it('displays error message', () => {
    const onSubmit = jest.fn();
    render(
      <DynamicForm
        schema={mockFormSchema}
        onSubmit={onSubmit}
        isLoading={false}
        error="Failed to submit form"
      />
    );

    expect(screen.getByText('Failed to submit form')).toBeInTheDocument();
  });
});
