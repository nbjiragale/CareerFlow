"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "../ui/card";
import { Button } from "../ui/button";
import {
  ListFilter,
  Loader,
  PlusCircle,
  Filter,
  Search,
  BellRing,
} from "lucide-react";
import { Input } from "../ui/input";
import {
  deleteTaskById,
  getTaskById,
  getTasksList,
  getTasksSummary,
  updateTaskStatus,
  startActivityFromTask,
} from "@/actions/task.actions";
import { toast } from "../ui/use-toast";
import { Task, TaskStatus, TASK_STATUSES } from "@/models/task.model";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { RecordsPerPageSelector } from "../RecordsPerPageSelector";
import { RecordsCount } from "../RecordsCount";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { APP_CONSTANTS } from "@/lib/constants";
import Loading from "../Loading";
import TasksTable from "./TasksTable";
import { TaskForm } from "./TaskForm";
import { ActivityType } from "@/models/activity.model";
import { useActivity } from "@/context/ActivityContext";

type TasksContainerProps = {
  activityTypes: ActivityType[];
  filterKey?: string;
  onFilterChange?: (filter: string | undefined) => void;
  onTasksChanged?: () => void;
};

const DEFAULT_STATUS_FILTER: TaskStatus[] = ["in-progress", "needs-attention"];

function TasksContainer({
  activityTypes,
  filterKey,
  onFilterChange,
  onTasksChanged,
}: TasksContainerProps) {
  const router = useRouter();
  const { refreshCurrentActivity } = useActivity();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [groupBy, setGroupBy] = useState<
    "none" | "createdDate" | "dueDate" | "updatedDate" | "activityType"
  >("none");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>(
    DEFAULT_STATUS_FILTER,
  );
  const [recordsPerPage, setRecordsPerPage] = useState<number>(
    APP_CONSTANTS.RECORDS_PER_PAGE,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const hasSearched = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  // CAREERFLOW: redesign (PR E) — server-side aggregate counts for the
  // Reminders subline + DONE/PENDING/URGENT strip. Independent of the
  // current statusFilter / page so the header is always accurate.
  const [summary, setSummary] = useState<{
    done: number;
    pending: number;
    urgent: number;
    total: number;
  }>({ done: 0, pending: 0, urgent: 0, total: 0 });

  // Avoid hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  const tasksPerPage = recordsPerPage;

  const loadTasks = useCallback(
    async (
      pageNum: number,
      filter?: string,
      statuses?: TaskStatus[],
      search?: string,
    ) => {
      if (pageNum === 1) setInitialLoading(true);
      else setLoadingMore(true);
      const { success, data, total, message } = await getTasksList(
        pageNum,
        tasksPerPage,
        filter,
        statuses,
        search,
      );
      if (success && data) {
        setTasks((prev) => (pageNum === 1 ? data : [...prev, ...data]));
        setTotalTasks(total);
        setPage(pageNum);
      } else {
        toast({
          variant: "destructive",
          title: "Error!",
          description: message,
        });
      }
      setInitialLoading(false);
      setLoadingMore(false);
    },
    [tasksPerPage],
  );

  // CAREERFLOW: redesign (PR E) — refresh server-side summary counts; called
  // on mount, when the activity-type filter changes, and after any mutation
  // that can move a task between statuses.
  const refreshSummary = useCallback(async () => {
    const result = await getTasksSummary(filterKey);
    if (result.success) {
      setSummary(result.data);
    }
  }, [filterKey]);

  const reloadTasks = useCallback(async () => {
    await loadTasks(1, filterKey, statusFilter, searchTerm || undefined);
    await refreshSummary();
    onTasksChanged?.();
  }, [
    loadTasks,
    filterKey,
    statusFilter,
    searchTerm,
    onTasksChanged,
    refreshSummary,
  ]);

  const onDeleteTask = async (taskId: string) => {
    const { success, message } = await deleteTaskById(taskId);
    if (success) {
      toast({
        variant: "success",
        description: "Task has been deleted successfully",
      });
      reloadTasks();
    } else {
      toast({
        variant: "destructive",
        title: "Error!",
        description: message,
      });
    }
  };

  const onEditTask = async (taskId: string) => {
    const { data, success, message } = await getTaskById(taskId);
    if (!success) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: message,
      });
      return;
    }
    setEditTask(data);
    setDialogOpen(true);
  };

  const addTaskForm = () => {
    resetEditTask();
    setDialogOpen(true);
  };

  const onChangeTaskStatus = async (taskId: string, status: TaskStatus) => {
    const originalTasks = [...tasks];
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );

    const { success, message } = await updateTaskStatus(taskId, status);
    if (success) {
      toast({
        variant: "success",
        description: "Task status updated successfully",
      });
      onTasksChanged?.();
      // Keep the summary strip in sync after a status change.
      refreshSummary();
    } else {
      setTasks(originalTasks);
      toast({
        variant: "destructive",
        title: "Error!",
        description: message,
      });
    }
  };

  const onStartActivity = async (taskId: string) => {
    const { success, message } = await startActivityFromTask(taskId);
    if (success) {
      await refreshCurrentActivity();
      toast({
        variant: "success",
        description: "Activity started from task",
      });
      router.push("/dashboard/activities");
    } else {
      toast({
        variant: "destructive",
        title: "Error!",
        description: message,
      });
    }
  };

  const resetEditTask = () => {
    setEditTask(null);
  };

  useEffect(() => {
    (async () =>
      await loadTasks(1, filterKey, statusFilter, searchTerm || undefined))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTasks, filterKey, statusFilter, recordsPerPage]);

  // CAREERFLOW: redesign (PR E) — keep summary in sync with the activity-type
  // filter. Status filter / search shouldn't change the aggregate counts.
  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  // Debounced search effect
  useEffect(() => {
    if (searchTerm !== "") {
      hasSearched.current = true;
    }
    if (searchTerm === "" && !hasSearched.current) return;

    const timer = setTimeout(() => {
      loadTasks(1, filterKey, statusFilter, searchTerm || undefined);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Infinite scroll: auto-load next page when sentinel is visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !initialLoading &&
          !loadingMore &&
          tasks.length < totalTasks
        ) {
          loadTasks(
            page + 1,
            filterKey,
            statusFilter,
            searchTerm || undefined,
          );
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    tasks.length,
    totalTasks,
    page,
    filterKey,
    statusFilter,
    searchTerm,
    initialLoading,
    loadingMore,
    loadTasks,
  ]);

  const onGroupByChange = (value: string) => {
    setGroupBy(
      value as
        | "none"
        | "createdDate"
        | "dueDate"
        | "updatedDate"
        | "activityType",
    );
  };

  const toggleStatusFilter = (status: TaskStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  // CAREERFLOW: redesign (PR E) — subline derives from the server-side
  // aggregate so it stays coherent even when statusFilter excludes
  // "complete" tasks from the visible page.
  const subline = summary.total === 0
    ? "No reminders yet"
    : `${summary.done} / ${summary.total} done · ${summary.urgent} urgent`;

  return (
    <div className="flex flex-col gap-4">
      {/* CAREERFLOW: redesign (PR E) — page header + secondary CTAs outside
          the table card so they read as page chrome. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Reminders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subline}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 gap-1">
            <Link href="/dashboard/settings?section=notifications">
              <BellRing className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Notification rules
              </span>
            </Link>
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1"
            onClick={addTaskForm}
            data-testid="add-task-btn"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              New reminder
            </span>
          </Button>
        </div>
      </div>

      {/* CAREERFLOW: redesign (PR E) — DONE / PENDING / URGENT strip. */}
      <div className="grid grid-cols-3 gap-3">
        <ProgressCell
          label="Done"
          value={summary.done}
          tone="offer"
          testId="reminders-stat-done"
        />
        <ProgressCell
          label="Pending"
          value={summary.pending}
          tone="applied"
          testId="reminders-stat-pending"
        />
        <ProgressCell
          label="Urgent"
          value={summary.urgent}
          tone="interview"
          testId="reminders-stat-urgent"
        />
      </div>

      <Card x-chunk="dashboard-tasks-chunk-0" className="h-full density-card p-0">
        <CardHeader className="density-card-header flex-row justify-end items-center">
          <div className="flex items-center">
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search tasks..."
                  className="pl-8 h-8 w-[150px] lg:w-[200px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {mounted ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                      <Filter className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Status
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(Object.keys(TASK_STATUSES) as TaskStatus[]).map(
                      (status) => (
                        <DropdownMenuCheckboxItem
                          key={status}
                          checked={statusFilter.includes(status)}
                          onCheckedChange={() => toggleStatusFilter(status)}
                        >
                          {TASK_STATUSES[status]}
                        </DropdownMenuCheckboxItem>
                      ),
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Status
                  </span>
                </Button>
              )}
              {mounted ? (
                <Select value={groupBy} onValueChange={onGroupByChange}>
                  <SelectTrigger className="w-[140px] h-8">
                    <ListFilter className="h-3.5 w-3.5" />
                    <SelectValue placeholder="Group by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Group by</SelectLabel>
                      <SelectSeparator />
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="createdDate">Created Date</SelectItem>
                      <SelectItem value="dueDate">Due Date</SelectItem>
                      <SelectItem value="updatedDate">Updated Date</SelectItem>
                      <SelectItem value="activityType">
                        Activity Type
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 w-[140px]"
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  <span>Group by</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="density-card-content">
          {initialLoading && <Loading />}
          {!initialLoading && tasks.length > 0 && (
            <>
              <TasksTable
                tasks={tasks}
                deleteTask={onDeleteTask}
                editTask={onEditTask}
                onChangeTaskStatus={onChangeTaskStatus}
                onStartActivity={onStartActivity}
                groupBy={groupBy}
              />
              <div className="flex items-center justify-between mt-4">
                <RecordsCount
                  count={tasks.length}
                  total={totalTasks}
                  label="tasks"
                />
                {totalTasks > APP_CONSTANTS.RECORDS_PER_PAGE && (
                  <RecordsPerPageSelector
                    value={recordsPerPage}
                    onChange={setRecordsPerPage}
                  />
                )}
              </div>
            </>
          )}
          {!initialLoading && tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No tasks found. Create your first task to get started.
            </div>
          )}
          {tasks.length < totalTasks && (
            <div ref={sentinelRef} className="flex justify-center p-4">
              {loadingMore && (
                <Loader className="h-5 w-5 animate-spin text-blue-500" />
              )}
            </div>
          )}
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
      <TaskForm
        activityTypes={activityTypes}
        editTask={editTask}
        resetEditTask={resetEditTask}
        onTaskSaved={reloadTasks}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
      />
    </div>
  );
}

// CAREERFLOW: redesign (PR E) — tiny stat cell for the DONE/PENDING/URGENT
// strip above the reminders table. Reuses the status-pill palette via the
// design token vars from globals.css.
function ProgressCell({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: number;
  tone: "applied" | "offer" | "interview";
  testId?: string;
}) {
  const toneVar =
    tone === "offer"
      ? "var(--st-offer)"
      : tone === "interview"
        ? "var(--st-interview)"
        : "var(--st-applied)";
  return (
    <div
      className="density-card rounded-lg border bg-card text-card-foreground shadow-sm"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: toneVar }}
          aria-hidden="true"
        />
      </div>
      <div
        className="mt-2 text-2xl font-semibold tabular-nums"
        style={{ color: toneVar }}
      >
        {value}
      </div>
    </div>
  );
}

export default TasksContainer;
export type { TasksContainerProps };
