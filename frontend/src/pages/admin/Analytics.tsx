import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  Download,
  Filter,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useForms, useFormAnalytics } from "@/hooks/useEvaluations";
import { toast } from "@/lib/notifications";

const AdminAnalytics = () => {
  const { data: forms, isLoading: isLoadingForms } = useForms(); // Fetch all forms for the org
  const [chosenFormId, setSelectedFormId] = useState<string>("all");


  const availableForms = (forms || []).filter(form => {
    // Hide soft-deleted forms
    if (form.is_deleted) return false;
    // Hide draft forms (inactive and results not released)
    if (!form.is_active && !form.results_released) return false;
    return true;
  });

  const defaultForm = availableForms.find(f => f.is_active) || availableForms[0];
  const selectedFormId = chosenFormId === "all" && defaultForm ? String(defaultForm.id) : chosenFormId;

  const formIdToFetch = selectedFormId !== "all" ? parseInt(selectedFormId) : undefined;

  const { data: analyticsData, isLoading: isLoadingAnalytics } = useFormAnalytics(formIdToFetch);

  const getExportData = () => {
    if (!analyticsData) return null;

    // Aggregate the data well into a flat structure suitable for CSV or direct JSON
    return {
      form_details: analyticsData.form_details,
      overview: {
        form_id: selectedFormId,
        overall_score: analyticsData.overall_score,
        total_evaluations: analyticsData.total_evaluations,
        participation_rate: analyticsData.participation_rate,
      },
      top_questions: analyticsData.category_data,
      top_performers: analyticsData.top_performers,
      unit_performance: analyticsData.unit_breakdown,
      raw_responses: analyticsData.raw_data
    };
  };

  const handleExportJSON = () => {
    const data = getExportData();
    if (!data) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `analytics_form_${selectedFormId}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    toast.success("Success", {
      description: "Analytics data exported as JSON",
    });
  };

  const handleExportCSV = () => {
    const data = getExportData();
    if (!data) return;

    let csvContent = "";

    // 0. Form Details Section
    csvContent += "FORM DETAILS\n";
    csvContent += "title,description,created_at,end_date,is_active,results_released\n";
    if (data.form_details) {
      const title = `"${(data.form_details.title || "").replace(/"/g, '""')}"`;
      const desc = `"${(data.form_details.description || "").replace(/"/g, '""')}"`;
      csvContent += `${title},${desc},${data.form_details.created_at || ""},${data.form_details.end_date || ""},${data.form_details.is_active || false},${data.form_details.results_released || false}\n\n`;
    }

    // 1. Overview Section
    csvContent += "OVERVIEW\n";
    csvContent += "overall_score,total_evaluations,participation_rate\n";
    csvContent += `${data.overview.overall_score},${data.overview.total_evaluations},${data.overview.participation_rate}%\n\n`;

    // 2. Top Questions
    csvContent += "TOP QUESTIONS\n";
    csvContent += "question,average_score\n";
    data.top_questions.forEach(q => {
      // Escape quotes for CSV
      const escapedName = `"${q.name.replace(/"/g, '""')}"`;
      csvContent += `${escapedName},${q.score}\n`;
    });
    csvContent += "\n";

    // 3. Top Performers
    csvContent += "TOP PERFORMERS\n";
    csvContent += "rank,name,unit,score\n";
    data.top_performers.forEach(p => {
      csvContent += `${p.rank},"${p.name}","${p.unit}",${p.score}\n`;
    });
    csvContent += "\n";

    // 4. Unit Performance
    csvContent += "UNIT PERFORMANCE\n";
    csvContent += "unit,members_evaluated,average_score,completion_rate\n";
    data.unit_performance.forEach(u => {
      csvContent += `"${u.unit}",${u.members},${u.avgScore},${u.completion}%\n`;
    });
    csvContent += "\n";

    // 5. Raw Data
    csvContent += "RAW DATA\n";
    csvContent += "evaluator,evaluatee,question,score,response,submitted_at\n";
    if (data.raw_responses && data.raw_responses.length > 0) {
      data.raw_responses.forEach(r => {
        const escapedQuestion = `"${r.question_text.replace(/"/g, '""')}"`;
        const escapedResponse = r.text_response ? `"${r.text_response.replace(/"/g, '""')}"` : "";
        csvContent += `"${r.evaluator_name}","${r.evaluatee_name}",${escapedQuestion},${r.score || ""},${escapedResponse},${r.submitted_at || ""}\n`;
      });
    } else {
      csvContent += "No raw responses available.\n";
    }

    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `analytics_form_${selectedFormId}.csv`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    toast.success("Success", {
      description: "Analytics data exported as CSV",
    });
  };

  const isLoading = isLoadingForms || isLoadingAnalytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics & Reports</h1>
          <p className="text-muted-foreground">Comprehensive evaluation insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedFormId}
            onValueChange={setSelectedFormId}
            disabled={isLoadingForms || availableForms.length === 0}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select Evaluation Form" />
            </SelectTrigger>
            <SelectContent>
              {availableForms.map((form) => (
                <SelectItem key={form.id} value={form.id.toString()}>
                  {form.title} {form.is_active ? '(Active)' : '(Archived/Released)'}
                </SelectItem>
              ))}
              {availableForms.length === 0 && (
                <SelectItem value="all" disabled>No forms available</SelectItem>
              )}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!formIdToFetch || isLoading}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 h-64 border rounded-lg bg-card text-card-foreground shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      ) : !analyticsData ? (
        <div className="flex flex-col items-center justify-center p-12 h-64 border rounded-lg bg-card text-muted-foreground shadow-sm">
          <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
          <p>Please select an evaluation form to view its analytics.</p>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                    <p className="text-3xl font-bold text-foreground">{analyticsData.overall_score}</p>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">--</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Evaluations</p>
                    <p className="text-3xl font-bold text-foreground">{analyticsData.total_evaluations}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Participation Rate</p>
                    <p className="text-3xl font-bold text-foreground">{analyticsData.participation_rate}%</p>
                  </div>
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Top Performer</p>
                    <p className="text-xl font-bold text-foreground">
                      {analyticsData.top_performers.length > 0 ? analyticsData.top_performers[0].name : 'N/A'}
                    </p>
                  </div>
                  <Award className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score by Category (Top Questions) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Scoring Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.category_data} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 'dataMax + 1']} />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Performers */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.top_performers.map((performer) => (
                    <div key={performer.rank} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${performer.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                        performer.rank === 2 ? 'bg-gray-100 text-gray-700' :
                          performer.rank === 3 ? 'bg-orange-100 text-orange-700' :
                            'bg-muted text-muted-foreground'
                        }`}>
                        {performer.rank}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{performer.name}</p>
                        <p className="text-xs text-muted-foreground">{performer.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{performer.score}</span>
                        {performer.trend === "up" && <TrendingUp className="w-4 h-4 text-green-600" />}
                        {performer.trend === "down" && <TrendingDown className="w-4 h-4 text-red-600" />}
                      </div>
                    </div>
                  ))}
                  {analyticsData.top_performers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No performance data available yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Unit Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Performance by Unit</CardTitle>
                  <Button variant="ghost" size="sm" disabled>
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-center">Members evaluated</TableHead>
                        <TableHead className="text-center">Avg Score</TableHead>
                        <TableHead>Eval. Completion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyticsData.unit_breakdown.map((unit) => (
                        <TableRow key={unit.unit}>
                          <TableCell className="font-medium">{unit.unit}</TableCell>
                          <TableCell className="text-center">{unit.members}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={unit.avgScore >= 4.3 ? "default" : "secondary"}>
                              {unit.avgScore}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={unit.completion} className="h-2 w-20" />
                              <span className="text-sm text-muted-foreground">{unit.completion}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score Distribution by Unit (Pie Chart) */}
          <Card>
            <CardHeader>
              <CardTitle>Score Distribution by Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.unit_data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {analyticsData.unit_data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {analyticsData.unit_data.map((unit) => (
                  <div key={unit.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: unit.color }} />
                    <span className="text-sm text-muted-foreground">{unit.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;
