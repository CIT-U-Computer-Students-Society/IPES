import { useState, useEffect, useRef } from "react";
import {
  FileEdit,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Edit,
  Trash2,
  Eye,
  GripVertical,
  Type,
  ListOrdered,
  AlignLeft,
  ToggleLeft,
  Star,
  Save,
  Send,
  Loader2,
  Info,
  Archive,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast as sonnerToast } from "@/lib/notifications";
import { formatApiError } from "@/lib/api";

import {
  useForms, useCreateForm, useUpdateForm, useDeleteForm, useDuplicateForm, useActivateForm, useDeactivateForm, useReleaseResults,
  useFormQuestions, useCreateQuestions, useUpdateQuestion, useDeleteQuestion, useFormCompletedCount,
  useFormRules, useCreateRule, useDeleteRule, useGenerateAssignments,
  type EvaluationForm, type Question, type AssignmentRule
} from "@/hooks/useEvaluations";
import {
  useOrganizationUnits, usePositionTypes,
  type OrganizationUnit, type PositionType
} from "@/hooks/useOrganizations";
import { useOrganizationState } from "@/contexts/OrganizationContext";

const questionTypes = [
  { id: "rating", name: "Rating Scale", icon: Star, description: "Numeric rating boundaries" },
  { id: "number", name: "Numeric Input", icon: ListOrdered, description: "Specific number value" },
  { id: "text", name: "Short Text", icon: Type, description: "Single line answer" },
  { id: "textarea", name: "Paragraph Response", icon: AlignLeft, description: "Detailed text answer" },
];

interface SortableQuestionItemProps {
  question: Partial<Question> & { tempId?: string };
  idx: number;
  selectedForm: EvaluationForm | null;
  handleQuestionChange: <K extends keyof Question>(index: number, field: K, value: Question[K]) => void;
  handleRemoveQuestion: (index: number) => void;
}

const SortableQuestionItem = ({
  question,
  idx,
  selectedForm,
  handleQuestionChange,
  handleRemoveQuestion
}: SortableQuestionItemProps) => {
  const itemId = question.id || question.tempId || `idx-${idx}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId,
    disabled: !!selectedForm?.is_active
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow relative group ${isDragging ? 'shadow-lg border-primary/50' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className={`mt-2 ${selectedForm?.is_active ? "text-muted-foreground/30 cursor-not-allowed" : "cursor-move text-muted-foreground hover:text-foreground touch-none"}`}
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {questionTypes.find(t => t.id === question.input_type)?.name || question.input_type}
          </Badge>
          <span className="text-xs text-muted-foreground">Order: {question.order}</span>
          {!question.id && <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">Unsaved</Badge>}
        </div>

        <div className="grid gap-2">
          <Label>Question Text</Label>
          <Input
            value={question.text}
            onChange={(e) => handleQuestionChange(idx, 'text', e.target.value)}
            placeholder="Type your question here..."
            disabled={selectedForm?.is_active}
            maxLength={500}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-3 rounded-md">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Weight</Label>
            <Input
              type="number" step="0.5"
              value={question.weight}
              onChange={(e) => handleQuestionChange(idx, 'weight', parseFloat(e.target.value))}
              disabled={selectedForm?.is_active}
            />
          </div>
          {(question.input_type === 'rating' || question.input_type === 'number') && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Min Value</Label>
                <Input
                  type="number"
                  value={question.min_value}
                  onChange={(e) => handleQuestionChange(idx, 'min_value', parseInt(e.target.value))}
                  disabled={selectedForm?.is_active}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Max Value</Label>
                <Input
                  type="number"
                  value={question.max_value}
                  onChange={(e) => handleQuestionChange(idx, 'max_value', parseInt(e.target.value))}
                  disabled={selectedForm?.is_active}
                />
              </div>
            </>
          )}
          <div className="flex items-center pt-5 pl-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={question.is_required}
                onChange={(e) => handleQuestionChange(idx, 'is_required', e.target.checked)}
                disabled={selectedForm?.is_active}
                className="rounded border-gray-300 text-primary shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
              Required Field
            </label>
          </div>
        </div>
      </div>
      <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleRemoveQuestion(idx)} disabled={selectedForm?.is_active}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const AdminFormBuilder = () => {
  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
    } else {
      sonnerToast.success(title, { description });
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("forms");

  // Create Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState("");
  const [newFormDesc, setNewFormDesc] = useState("");

  // Selected Form State
  const [selectedForm, setSelectedForm] = useState<EvaluationForm | null>(null);

  // Active organization
  const { activeOrganizationId } = useOrganizationState();

  // Publish confirmation dialog
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);

  // Release results confirmation dialog
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [formToRelease, setFormToRelease] = useState<EvaluationForm | null>(null);

  // Deactivate confirmation dialog
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);

  // Delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<EvaluationForm | null>(null);

  // Duplicate confirmation dialog
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [formToDuplicate, setFormToDuplicate] = useState<EvaluationForm | null>(null);

  // Edit Details State
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    start_date: string;
    end_date: string;
  }>({ title: '', description: '', start_date: '', end_date: '' });

  // Questions State
  const [localQuestions, setLocalQuestions] = useState<(Partial<Question> & { tempId?: string })[]>([]);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<number[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // API Hooks
  const { data: forms = [], isLoading: formsLoading } = useForms();
  const createFormMutation = useCreateForm();
  const updateFormMutation = useUpdateForm();
  const deleteFormMutation = useDeleteForm();
  const duplicateFormMutation = useDuplicateForm();
  const activateFormMutation = useActivateForm();
  const deactivateFormMutation = useDeactivateForm();
  const releaseResultsMutation = useReleaseResults();

  const { data: formQuestions = [], isLoading: questionsLoading, refetch: refetchQuestions } = useFormQuestions(selectedForm?.id || 0);
  const createQuestionsMutation = useCreateQuestions();
  const updateQuestionMutation = useUpdateQuestion();
  const deleteQuestionMutation = useDeleteQuestion();
  
  // Completed count for edit warning
  const { data: completedCountData } = useFormCompletedCount(selectedForm?.id || 0);
  const completedAssignmentCount = completedCountData?.completed_count || 0;
  
  // Save warning dialog (for forms with completed responses)
  const [isSaveWarningOpen, setIsSaveWarningOpen] = useState(false);
  
  // Activate warning dialog (for forms with completed responses)
  const [isActivateWarningOpen, setIsActivateWarningOpen] = useState(false);

  // Assignment Rules hooks
  const { data: formRules = [], isLoading: rulesLoading } = useFormRules(selectedForm?.id || 0);
  const createRuleMutation = useCreateRule();
  const deleteRuleMutation = useDeleteRule();
  const generateMutation = useGenerateAssignments();

  // Organization structure (for rule builder dropdowns)
  const { data: units = [] } = useOrganizationUnits();
  const { data: positions = [] } = usePositionTypes();

  // Track which rule ID is currently being deleted (for per-row loading state)
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);

  // Rule builder state
  const [newRule, setNewRule] = useState<{
    evaluator_unit: number | null;
    evaluator_position: number | null;
    evaluatee_unit: number | null;
    evaluatee_position: number | null;
    exclude_self: boolean;
  }>({
    evaluator_unit: null,
    evaluator_position: null,
    evaluatee_unit: null,
    evaluatee_position: null,
    exclude_self: true,
  });

  // Use a ref to track which form ID was last seeded into localQuestions.
  // This prevents two failure modes:
  //   a) Infinite loop: formQuestions reference changes every render even when data is the same
  //   b) Race condition: effect fires before fetch completes (questionsLoading=true), seeds [] into
  //      localQuestions, then when fetch resolves there's no dep change to re-trigger seeding.
  const seededFormIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectedForm) {
      seededFormIdRef.current = null;
      return;
    }
    if (activeTab === 'builder' && !questionsLoading && seededFormIdRef.current !== selectedForm.id) {
      seededFormIdRef.current = selectedForm.id;
      // Add a tempId to any question that doesn't have an id, so dnd-kit has a stable identifier
      const questionsWithIds = formQuestions.map(q => ({
        ...q,
        tempId: q.id ? undefined : `temp-${crypto.randomUUID()}`
      }));
      setLocalQuestions(questionsWithIds);
      setDeletedQuestionIds([]); // Reset deletions when switching forms
    }
    // formQuestions deliberately NOT in deps — its reference changes every render.
    // We capture the current value when the stable deps (id, tab, loading) change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedForm?.id, activeTab, questionsLoading]);



  const filteredForms = forms.filter(f =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (is_active: boolean, results_released: boolean) => {
    if (results_released) return "bg-purple-100 text-purple-700";
    if (is_active) return "bg-green-100 text-green-700";
    return "bg-yellow-100 text-yellow-700";
  };

  const getStatusText = (form: EvaluationForm) => {
    if (form.results_released) return "Results Released";
    if (form.is_active) return "Active";
    return "Draft";
  };

  // Form Actions
  const handleCreateForm = async () => {
    if (!newFormTitle) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
      return;
    }
    if (!activeOrganizationId) {
      toast({ title: "No Organization Selected", description: "Please select an organization first.", variant: "destructive" });
      return;
    }
    try {
      const res = await createFormMutation.mutateAsync({
        title: newFormTitle,
        description: newFormDesc,
        organization_id: activeOrganizationId,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_active: false,
        results_released: false
      });
      setIsCreateOpen(false);
      setNewFormTitle("");
      setNewFormDesc("");
      toast({ title: "Form Created", description: "Successfully created new form." });

      setSelectedForm(res);
      setActiveTab("builder");
    } catch (e: unknown) {
      toast({ title: "Error Creating Form", description: formatApiError(e), variant: "destructive" });
    }
  };

  const handleDeleteForm = async () => {
    if (!formToDelete) return;
    setIsDeleteDialogOpen(false);
    try {
      await deleteFormMutation.mutateAsync(formToDelete.id);
      toast({ title: "Form Deleted", description: `"${formToDelete.title}" has been permanently deleted.` });
      if (selectedForm?.id === formToDelete.id) {
        setSelectedForm(null);
        setActiveTab("forms");
      }
      setFormToDelete(null);
    } catch (e: unknown) {
      toast({ title: "Error Deleting Form", description: formatApiError(e), variant: "destructive" });
    }
  };

  const handleDuplicateForm = async (goToNew: boolean) => {
    if (!formToDuplicate) return;
    setIsDuplicateDialogOpen(false);
    try {
      const newForm = await duplicateFormMutation.mutateAsync(formToDuplicate.id);
      toast({ title: "Form Duplicated", description: `"${formToDuplicate.title} (Copy)" created.` });
      if (goToNew && newForm) {
        setSelectedForm(newForm as EvaluationForm);
        setActiveTab("builder");
      }
      setFormToDuplicate(null);
    } catch (e: unknown) {
      toast({ title: "Error Duplicating Form", description: formatApiError(e), variant: "destructive" });
    }
  };

  const handleActivateForm = async () => {
    if (!selectedForm) return;
    setIsActivateDialogOpen(false);
    
    // Validate empty questions
    if (localQuestions.some(q => !q.text || q.text.trim() === '')) {
      toast({ title: "Validation Error", description: "Question text cannot be empty.", variant: "destructive" });
      return;
    }
    
    // Show warning if there are completed assignments AND questions changed
    if (completedAssignmentCount > 0 && hasQuestionChanges()) {
      setIsActivateWarningOpen(true);
      return;
    }
    
    await performActivateForm();
  };

  const performActivateForm = async () => {
    if (!selectedForm) return;
    setIsActivateWarningOpen(false);
    
    try {
      // Save any unsaved questions first
      const newQuestions = localQuestions.filter(q => !q.id);
      const existingQuestions = localQuestions.filter(q => q.id);

      // Update existing linearly
      for (const q of existingQuestions) {
        if (q.id) {
          await updateQuestionMutation.mutateAsync({
            id: q.id,
            form_id: selectedForm.id,
            data: {
              text: q.text, order: q.order, weight: q.weight, input_type: q.input_type,
              is_required: q.is_required, min_value: q.min_value, max_value: q.max_value
            }
          });
        }
      }

      // Process deferred deletions
      if (deletedQuestionIds.length > 0) {
        for (const id of deletedQuestionIds) {
          await deleteQuestionMutation.mutateAsync({ id, form_id: selectedForm.id });
        }
        setDeletedQuestionIds([]);
      }

      // Bulk create new questions
      if (newQuestions.length > 0) {
        await createQuestionsMutation.mutateAsync({
          form_id: selectedForm.id,
          questions: newQuestions.map(q => ({
            text: q.text, input_type: q.input_type, order: q.order, weight: q.weight,
            is_required: q.is_required, min_value: q.min_value, max_value: q.max_value
          }))
        });
      }

      // Refresh questions after save
      const { data: freshQuestions } = await refetchQuestions();
      if (freshQuestions) {
        setLocalQuestions(freshQuestions);
        seededFormIdRef.current = selectedForm.id;
      }
      
      // Now activate the form
      await activateFormMutation.mutateAsync(selectedForm.id);
      toast({ title: "Form Activated", description: "Questions saved and form is now ready for assignments." });
      setSelectedForm({ ...selectedForm, is_active: true });
    } catch (e: unknown) {
      toast({ title: "Error Activating Form", description: formatApiError(e), variant: "destructive" });
    }
  };

  const handleDeactivateForm = async () => {
    if (!selectedForm) return;
    setIsDeactivateDialogOpen(false);
    try {
      await deactivateFormMutation.mutateAsync(selectedForm.id);
      toast({ title: "Form Deactivated", description: "This form is closed for new assignments." });
      setSelectedForm({ ...selectedForm, is_active: false });
    } catch (e: unknown) {
      toast({ title: "Error Deactivating Form", description: formatApiError(e), variant: "destructive" });
    }
  };

  const handleReleaseResults = async () => {
    if (!formToRelease) return;
    setIsReleaseDialogOpen(false);
    try {
      await releaseResultsMutation.mutateAsync(formToRelease.id);
      toast({ title: "Results Released", description: "Evaluations are now visible to evaluatees." });
      if (selectedForm?.id === formToRelease.id) {
        setSelectedForm({ ...selectedForm, results_released: true, is_active: false });
      }
      setFormToRelease(null);
    } catch (e: unknown) {
      toast({ title: "Error Releasing Results", description: formatApiError(e), variant: "destructive" });
    }
  };

  // Open the details panel, pre-populating with current form data
  const handleOpenEditDetails = () => {
    if (!selectedForm) return;
    setEditFormData({
      title: selectedForm.title,
      description: selectedForm.description ?? '',
      start_date: selectedForm.start_date,
      end_date: selectedForm.end_date,
    });
    setIsEditingDetails(true);
  };

  const handleSaveDetails = async () => {
    if (!selectedForm) return;
    if (!editFormData.title.trim()) {
      toast({ title: "Validation Error", description: "Title cannot be empty.", variant: "destructive" });
      return;
    }
    try {
      const updated = await updateFormMutation.mutateAsync({ id: selectedForm.id, data: editFormData });
      setSelectedForm(updated);
      setIsEditingDetails(false);
      toast({ title: "Details Saved", description: "Form details updated successfully." });
    } catch (e: unknown) {
      toast({ title: "Error Saving Details", description: formatApiError(e), variant: "destructive" });
    }
  };

  // Assignment Rule Actions
  const handleAddRule = async () => {
    if (!selectedForm) return;
    // #4: client-side duplicate rule guard
    const isDuplicate = formRules.some(r =>
      r.evaluator_unit === newRule.evaluator_unit &&
      r.evaluator_position === newRule.evaluator_position &&
      r.evaluatee_unit === newRule.evaluatee_unit &&
      r.evaluatee_position === newRule.evaluatee_position
    );
    if (isDuplicate) {
      toast({ title: "Duplicate Rule", description: "An identical rule already exists for this form.", variant: "destructive" });
      return;
    }
    try {
      await createRuleMutation.mutateAsync({ form_id: selectedForm.id, ...newRule });
      setNewRule({ evaluator_unit: null, evaluator_position: null, evaluatee_unit: null, evaluatee_position: null, exclude_self: true });
      toast({ title: "Rule Added" });
    } catch (e: unknown) {
      toast({ title: "Error Adding Rule", description: formatApiError(e), variant: "destructive" });
    }
  };

  const handleDeleteRule = async (rule: AssignmentRule) => {
    if (!selectedForm) return;
    setDeletingRuleId(rule.id);
    try {
      await deleteRuleMutation.mutateAsync({ id: rule.id, form_id: selectedForm.id });
      toast({ title: "Rule Removed" });
    } catch (e: unknown) {
      toast({ title: "Error Removing Rule", description: formatApiError(e), variant: "destructive" });
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleGenerateAssignments = async () => {
    if (!selectedForm) return;
    try {
      const res = await generateMutation.mutateAsync(selectedForm.id);
      if (res.created === 0) {
        toast({ title: "Already Up to Date", description: "All assignments for this form already exist. No new assignments were created." });
      } else {
        toast({ title: "Assignments Generated", description: `${res.created} new assignment(s) created.` });
      }
    } catch (e: unknown) {
      toast({ title: "Error Generating Assignments", description: formatApiError(e), variant: "destructive" });
    }
  };

  const ruleLabel = (rule: AssignmentRule) => {
    const ev = `${rule.evaluator_unit_name ?? 'Any Unit'} / ${rule.evaluator_position_name ?? 'Any Position'}`;
    const ee = `${rule.evaluatee_unit_name ?? 'Any Unit'} / ${rule.evaluatee_position_name ?? 'Any Position'}`;
    return `[${ev}] → [${ee}]`;
  };

  // Question Actions
  const handleAddQuestion = (type: string) => {
    const nextOrder = localQuestions.length > 0 ? Math.max(...localQuestions.map(q => q.order || 0)) + 1 : 1;
    setLocalQuestions([...localQuestions, {
      text: "",
      input_type: type as Question['input_type'],
      order: nextOrder,
      weight: 1.0,
      is_required: true,
      min_value: (type === 'rating' || type === 'number') ? 1 : undefined,
      max_value: type === 'rating' ? 5 : (type === 'number' ? 100 : undefined),
      tempId: `temp-${crypto.randomUUID()}`,
    }]);
  };

  const handleRemoveQuestion = (index: number) => {
    const qToRemove = localQuestions[index];
    if (qToRemove.id) {
      setDeletedQuestionIds([...deletedQuestionIds, qToRemove.id]);
    }
    const newQs = [...localQuestions];
    newQs.splice(index, 1);
    
    // Auto re-order
    const reordered = newQs.map((q, idx) => ({ ...q, order: idx + 1 }));
    setLocalQuestions(reordered);
    toast({ title: "Question Removed", description: "Changes will be saved once you Save Draft." });
  };

  const handleQuestionChange = <K extends keyof Question>(index: number, field: K, value: Question[K]) => {
    const newQs = [...localQuestions];
    newQs[index] = { ...newQs[index], [field]: value };
    setLocalQuestions(newQs);
  };

  // Check if questions have actually changed (content, not just order)
  const hasQuestionChanges = () => {
    // Check if any were deleted
    if (deletedQuestionIds.length > 0) return true;

    // Check for new questions
    if (localQuestions.some(q => !q.id)) return true;
    
    // Check for content changes in existing questions
    for (const local of localQuestions) {
      if (!local.id) continue;
      const original = formQuestions.find(q => q.id === local.id);
      if (!original) continue;
      if (local.text !== original.text) return true;
      if (local.weight !== original.weight) return true;
      if (local.min_value !== original.min_value) return true;
      if (local.max_value !== original.max_value) return true;
      if (local.input_type !== original.input_type) return true;
      if (local.is_required !== original.is_required) return true;
      
      // Also check if order actually changed based on the original data
      if (local.order !== original.order) return true;
    }
    return false;
  };

  const handleSaveDraft = async () => {
    if (!selectedForm) return;

    // Validate empty questions
    if (localQuestions.some(q => !q.text || q.text.trim() === '')) {
      toast({ title: "Validation Error", description: "Question text cannot be empty.", variant: "destructive" });
      return;
    }

    // Show warning if there are completed assignments AND questions changed
    if (completedAssignmentCount > 0 && hasQuestionChanges()) {
      setIsSaveWarningOpen(true);
      return;
    }

    await performSaveDraft();
  };

  const performSaveDraft = async () => {
    if (!selectedForm) return;
    setIsSaveWarningOpen(false);

    setIsSavingDraft(true);
    try {
      const newQuestions = localQuestions.filter(q => !q.id);
      const existingQuestions = localQuestions.filter(q => q.id);

      // Update existing linearly
      for (const q of existingQuestions) {
        if (q.id) {
          await updateQuestionMutation.mutateAsync({
            id: q.id,
            form_id: selectedForm.id,
            data: {
              text: q.text, order: q.order, weight: q.weight, input_type: q.input_type,
              is_required: q.is_required, min_value: q.min_value, max_value: q.max_value
            }
          });
        }
      }

      // Process deferred deletions
      if (deletedQuestionIds.length > 0) {
        for (const id of deletedQuestionIds) {
          await deleteQuestionMutation.mutateAsync({ id, form_id: selectedForm.id });
        }
        setDeletedQuestionIds([]);
      }

      // Bulk create new questions
      if (newQuestions.length > 0) {
        await createQuestionsMutation.mutateAsync({
          form_id: selectedForm.id,
          questions: newQuestions.map(q => ({
            text: q.text, input_type: q.input_type, order: q.order, weight: q.weight,
            is_required: q.is_required, min_value: q.min_value, max_value: q.max_value
          }))
        });
      }

      toast({ title: "Draft Saved", description: "All questions have been saved successfully." });

      // Explicitly await the refetch and directly set localQuestions
      // This bypasses the useEffect which ignores background refetches due to unchanged 'loading' state
      const { data: freshQuestions } = await refetchQuestions();
      if (freshQuestions) {
        setLocalQuestions(freshQuestions);
        seededFormIdRef.current = selectedForm.id; // Keep our ref synced so useEffect won't randomly fire later
      }
    } catch (e: unknown) {
      toast({ title: "Error Saving", description: formatApiError(e), variant: "destructive" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // DND Handlers
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalQuestions((items) => {
        const oldIndex = items.findIndex((i) => (i.id || i.tempId) === active.id);
        const newIndex = items.findIndex((i) => (i.id || i.tempId) === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        // Recalculate orders based on new position
        return reordered.map((q, idx) => ({ ...q, order: idx + 1 }));
      });
    }
  };

  if (formsLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Form Builder</h1>
          <p className="text-muted-foreground">Create and manage evaluation forms</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-hero text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Create Form
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Form</DialogTitle>
              <DialogDescription className="sr-only">
                Fill in the details below to create a new evaluation form.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Form Title</Label>
                <Input
                  placeholder="e.g., Mid-Year Peer Evaluation"
                  value={newFormTitle}
                  onChange={(e) => setNewFormTitle(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of this evaluation form..."
                  value={newFormDesc}
                  onChange={(e) => setNewFormDesc(e.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleCreateForm} disabled={createFormMutation.isPending}>
                {createFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Form
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="forms">All Forms</TabsTrigger>
          <TabsTrigger value="builder" disabled={!selectedForm} className="max-w-[250px] sm:max-w-[350px]">
            Form Editor {selectedForm && <span className="truncate ml-1 align-bottom inline-block max-w-[120px] sm:max-w-[200px]">({selectedForm.title})</span>}
          </TabsTrigger>
          <TabsTrigger value="assignments" disabled={!selectedForm}>Assignments {selectedForm && formRules.length > 0 && `(${formRules.length} rule${formRules.length !== 1 ? 's' : ''})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="space-y-4 pt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search forms..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredForms.map((form) => (
              <Card
                key={form.id}
                className="hover:shadow-md transition-shadow cursor-pointer select-none"
                onDoubleClick={() => { setSelectedForm(form); setActiveTab("builder"); }}
                title="Double-click to open in Form Editor"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileEdit className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base truncate max-w-[180px]" title={form.title}>{form.title}</CardTitle>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedForm(form); setActiveTab("builder"); }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Form
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setFormToDuplicate(form); setIsDuplicateDialogOpen(true); }}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {!form.results_released && (
                          <DropdownMenuItem
                            onClick={() => { setFormToRelease(form); setIsReleaseDialogOpen(true); }}
                            className="text-purple-600 focus:bg-purple-50 focus:text-purple-700"
                            disabled={!form.questions || form.questions.length === 0}
                            title={(!form.questions || form.questions.length === 0) ? "Cannot release results for an empty form" : ""}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Release Results
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => { setFormToDelete(form); setIsDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(form.is_active, form.results_released)}`}>
                      {getStatusText(form)}
                    </span>
                    {/* Questions count would ideally come from a sub-query or an aggregation field from the backend */}
                    <span className="text-muted-foreground text-xs">ID: #{form.id}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created: {new Date(form.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredForms.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                No forms found. Create your first form to get started.
              </div>
            )}
          </div>

          {/* ── Delete Confirmation Dialog ── */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="break-all whitespace-normal overflow-hidden line-clamp-3 leading-tight">Delete "{formToDelete?.title}"?</DialogTitle>
                <DialogDescription>
                  This action is <strong>permanent and cannot be undone</strong>. The form, all its questions,
                  and any generated assignments will be deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteForm}
                  disabled={deleteFormMutation.isPending}
                >
                  {deleteFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Yes, Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Duplicate Confirmation Dialog ── */}
          <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="break-all whitespace-normal overflow-hidden line-clamp-3 leading-tight">Duplicate "{formToDuplicate?.title}"?</DialogTitle>
                <DialogDescription>
                  A copy will be created as a draft with all questions included. Assignments and rules will not be copied.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsDuplicateDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => handleDuplicateForm(false)}
                  disabled={duplicateFormMutation.isPending}
                >
                  {duplicateFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  Duplicate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Release Results Confirmation Dialog ── */}
          <Dialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen}>
            <DialogContent className="max-w-md min-w-0">
              <DialogHeader>
                <DialogTitle className="break-all whitespace-normal overflow-hidden line-clamp-3 leading-tight">Release Results for "{formToRelease?.title}"?</DialogTitle>
                <DialogDescription>
                  This will make the evaluation scores visible to all evaluatees.
                  The form will be deactivated for further responses.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsReleaseDialogOpen(false)}>Cancel</Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleReleaseResults}
                  disabled={releaseResultsMutation.isPending}
                >
                  {releaseResultsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Yes, Release Results
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </TabsContent>

        <TabsContent value="builder" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Question Types Panel */}
            <Card className="lg:col-span-1 h-fit sticky top-4">
              <CardHeader>
                <CardTitle className="text-base">Add Question Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedForm?.is_active && (
                  <div className="bg-amber-50 text-amber-800 text-xs p-2.5 rounded border border-amber-200 mb-3">
                    Form is active. Deactivate to edit questions.
                  </div>
                )}
                {questionTypes.map((type) => (
                  <div
                    key={type.id}
                    onClick={() => !selectedForm?.is_active && handleAddQuestion(type.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors ${
                      selectedForm?.is_active
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted cursor-pointer"
                    }`}
                  >
                    <type.icon className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{type.name}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Form Editor */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 w-full pr-4">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <CardTitle className="leading-tight break-words whitespace-normal line-clamp-5 text-balance max-w-full">
                          {selectedForm?.title}
                        </CardTitle>
                        {selectedForm?.is_active && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 whitespace-nowrap">Published</Badge>}
                      </div>
                      {selectedForm?.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{selectedForm.description}</p>
                      )}
                      {!selectedForm?.is_active && hasQuestionChanges() && (
                        <div className="flex items-center gap-2 mt-3 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md text-xs w-fit animate-in fade-in slide-in-from-top-1">
                          <Info className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-medium">You have unsaved changes in this form.</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!selectedForm?.is_active && (
                        <Button variant="outline" size="sm" onClick={handleOpenEditDetails}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Details
                        </Button>
                      )}
                      <Button variant="outline" onClick={handleSaveDraft} disabled={selectedForm?.is_active || isSavingDraft}>
                        {isSavingDraft ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isSavingDraft ? "Saving..." : "Save Draft"}
                      </Button>
                      
                      {/* Warning dialog for forms with completed responses */}
                      <Dialog open={isSaveWarningOpen} onOpenChange={setIsSaveWarningOpen}>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-amber-600">Warning: Responses Will Be Affected</DialogTitle>
                            <DialogDescription className="space-y-2 pt-2">
                              <p>
                                This form has <strong>{completedAssignmentCount}</strong> completed evaluation{completedAssignmentCount !== 1 ? 's' : ''}. 
                                Saving these changes will reset their status from "Completed" to "In Progress".
                              </p>
                              <p className="text-sm">
                                Members who already submitted will need to review and resubmit their responses. Existing answers will be preserved where questions remain unchanged.
                              </p>
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setIsSaveWarningOpen(false)}>Cancel</Button>
                            <Button
                              variant="destructive"
                              onClick={performSaveDraft}
                              disabled={isSavingDraft}
                            >
                              {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Save Anyway
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      {!selectedForm?.is_active && !selectedForm?.results_released && (
                        <>
                          <Button
                            className="gradient-hero text-primary-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                            onClick={() => setIsActivateDialogOpen(true)}
                            disabled={localQuestions.length === 0}
                            title={localQuestions.length === 0 ? "Add at least one question before activating this form" : ""}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Activate Form
                          </Button>
                          <Dialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="break-all whitespace-normal overflow-hidden line-clamp-3 leading-tight">Activate "{selectedForm?.title}"?</DialogTitle>
                                <DialogDescription>
                                  Activating changes the form state to 'Active' to allow responses.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setIsActivateDialogOpen(false)}>Cancel</Button>
                                <Button
                                  className="gradient-hero text-primary-foreground"
                                  onClick={handleActivateForm}
                                  disabled={activateFormMutation.isPending}
                                >
                                  {activateFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                  Yes, Activate
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          
                          {/* Warning dialog for activate with completed responses */}
                          <Dialog open={isActivateWarningOpen} onOpenChange={setIsActivateWarningOpen}>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="text-amber-600">Warning: Responses Will Be Affected</DialogTitle>
                                <DialogDescription className="space-y-2 pt-2">
                                  <p>
                                    This form has <strong>{completedAssignmentCount}</strong> completed evaluation{completedAssignmentCount !== 1 ? 's' : ''}. 
                                    Saving these changes will reset their status from "Completed" to "In Progress".
                                  </p>
                                  <p className="text-sm">
                                    Members who already submitted will need to review and resubmit their responses. Existing answers will be preserved where questions remain unchanged.
                                  </p>
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setIsActivateWarningOpen(false)}>Cancel</Button>
                                <Button
                                  variant="destructive"
                                  onClick={performActivateForm}
                                  disabled={activateFormMutation.isPending}
                                >
                                  {activateFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                  Save & Activate
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                      {selectedForm?.is_active && !selectedForm?.results_released && (
                        <>
                          <Button 
                            variant="outline" 
                            className="text-amber-700 font-semibold border-amber-500 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-600 transition-all duration-200 shadow-sm"
                            onClick={() => setIsDeactivateDialogOpen(true)}
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Deactivate Form
                          </Button>
                          <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="break-all whitespace-normal overflow-hidden line-clamp-3 leading-tight">Deactivate "{selectedForm?.title}"?</DialogTitle>
                                <DialogDescription>
                                  This will close the form to new evaluations, preventing any assignments from being completed.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setIsDeactivateDialogOpen(false)}>Cancel</Button>
                                <Button
                                  variant="destructive"
                                  onClick={handleDeactivateForm}
                                  disabled={deactivateFormMutation.isPending}
                                >
                                  {deactivateFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
                                  Yes, Deactivate
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline Edit Details Panel */}
                  {isEditingDetails && (
                    <div className="mt-4 p-4 rounded-lg border border-border bg-muted/30 space-y-4">
                      <p className="text-sm font-semibold">Edit Form Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={editFormData.title}
                            onChange={(e) => setEditFormData(d => ({ ...d, title: e.target.value }))}
                            placeholder="Form title"
                            maxLength={255}
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            value={editFormData.description}
                            onChange={(e) => setEditFormData(d => ({ ...d, description: e.target.value }))}
                            placeholder="Brief description (optional)"
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Start Date</Label>
                          <Input
                            type="date"
                            value={editFormData.start_date}
                            onChange={(e) => setEditFormData(d => ({ ...d, start_date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End Date</Label>
                          <Input
                            type="date"
                            value={editFormData.end_date}
                            onChange={(e) => setEditFormData(d => ({ ...d, end_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setIsEditingDetails(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveDetails} disabled={updateFormMutation.isPending}>
                          {updateFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {questionsLoading ? (
                    <div className="p-8 text-center text-muted-foreground animate-pulse">Loading questions...</div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={localQuestions.map((q, idx) => q.id || q.tempId || `idx-${idx}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4">
                          {localQuestions.map((question, idx) => (
                            <SortableQuestionItem
                              key={question.id || question.tempId || `idx-${idx}`}
                              question={question}
                              idx={idx}
                              selectedForm={selectedForm}
                              handleQuestionChange={handleQuestionChange}
                              handleRemoveQuestion={handleRemoveQuestion}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {localQuestions.length === 0 && !questionsLoading && (
                    <div className="py-12 text-center border-2 border-dashed border-border rounded-lg text-muted-foreground">
                      No questions yet. Click a question type on the left to add one.
                    </div>
                  )}

                  {!selectedForm?.is_active && (
                    <div className="bg-blue-50/50 text-blue-800 text-sm p-3 rounded border border-blue-100 flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                      <p>Remember to click <strong>Save Draft</strong> after making changes to questions.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Assignments Tab ── */}
        <TabsContent value="assignments" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment Rules for: {selectedForm?.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define who evaluates whom. Each rule cross-matches all matching evaluators with all matching evaluatees.
                Leave a field blank to match <em>any</em> unit or position.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Rule Builder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border border-border">
                {/* Evaluator Side */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Evaluator (Who evaluates)</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Organization Unit</Label>
                    <Select
                      value={newRule.evaluator_unit?.toString() ?? "__any_unit__"}
                      onValueChange={(v) => setNewRule(r => ({ ...r, evaluator_unit: v === '__any_unit__' ? null : parseInt(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Any unit" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any_unit__">Any unit</SelectItem>
                        {(units as OrganizationUnit[]).map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={newRule.evaluator_position?.toString() ?? "__any_pos__"}
                      onValueChange={(v) => setNewRule(r => ({ ...r, evaluator_position: v === '__any_pos__' ? null : parseInt(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Any position" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any_pos__">Any position</SelectItem>
                        {(positions as PositionType[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Evaluatee Side */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Evaluatee (Who gets evaluated)</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Organization Unit</Label>
                    <Select
                      value={newRule.evaluatee_unit?.toString() ?? "__any_unit__"}
                      onValueChange={(v) => setNewRule(r => ({ ...r, evaluatee_unit: v === '__any_unit__' ? null : parseInt(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Any unit" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any_unit__">Any unit</SelectItem>
                        {(units as OrganizationUnit[]).map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={newRule.evaluatee_position?.toString() ?? "__any_pos__"}
                      onValueChange={(v) => setNewRule(r => ({ ...r, evaluatee_position: v === '__any_pos__' ? null : parseInt(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Any position" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any_pos__">Any position</SelectItem>
                        {(positions as PositionType[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Exclude Self + Add Button */}
                <div className="md:col-span-2 flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRule.exclude_self}
                      onChange={(e) => setNewRule(r => ({ ...r, exclude_self: e.target.checked }))}
                      className="rounded border-gray-300 text-primary"
                    />
                    Exclude self-evaluation (evaluator ≠ evaluatee)
                  </label>
                  <Button onClick={handleAddRule} disabled={createRuleMutation.isPending}>
                    {createRuleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add Rule
                  </Button>
                </div>
              </div>

              {/* Saved Rules List */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Saved Rules {formRules.length > 0 && <span className="text-muted-foreground">({formRules.length})</span>}</p>
                {rulesLoading && <div className="text-muted-foreground text-sm animate-pulse">Loading rules...</div>}
                {!rulesLoading && formRules.length === 0 && (
                  <div className="py-6 text-center border-2 border-dashed border-border rounded-lg text-muted-foreground text-sm">
                    No rules yet. Add one above to define who evaluates whom.
                  </div>
                )}
                {formRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <p className="text-sm font-mono">{ruleLabel(rule)}</p>
                      {rule.exclude_self && <Badge variant="outline" className="text-xs">No self-eval</Badge>}
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive h-8 w-8"
                      onClick={() => handleDeleteRule(rule)}
                      disabled={deletingRuleId === rule.id}
                    >
                      {deletingRuleId === rule.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Generate Button — shown when rules exist OR while loading so it doesn't pop in late */}
              {(formRules.length > 0 || rulesLoading) && (
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {rulesLoading
                      ? "Loading rules…"
                      : `Applies ${formRules.length} rule(s) to generate concrete person-to-person assignments. Existing assignments are never duplicated.`}
                  </p>
                  <Button
                    className="gradient-hero text-primary-foreground"
                    onClick={handleGenerateAssignments}
                    disabled={generateMutation.isPending || rulesLoading || localQuestions.length === 0}
                    title={localQuestions.length === 0 ? "Form must have questions before assignments can be generated" : ""}
                  >
                    {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Generate Assignments
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div >
  );
};

export default AdminFormBuilder;
