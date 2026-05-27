"use client";
import { Resume, ResumeSection, SectionType } from "@/models/profile.model";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import AddResumeSection, { AddResumeSectionRef } from "./AddResumeSection";
import ContactInfoCard from "./ContactInfoCard";
import { useRef, useState } from "react";
import SummarySectionCard from "./SummarySectionCard";
import ExperienceCard from "./ExperienceCard";
import EducationCard from "./EducationCard";
import CertificationCard from "./CertificationCard";
import AiResumeReviewSection from "./AiResumeReviewSection";
import { DownloadFileButton } from "./DownloadFileButton";
import { Button } from "../ui/button";
import { Eye, EyeOff } from "lucide-react";
import ResumePdfPreview from "./pdf/ResumePdfPreview";
import DownloadResumePdfButton from "./pdf/DownloadResumePdfButton";

function ResumeContainer({ resume }: { resume: Resume }) {
  const resumeSectionRef = useRef<AddResumeSectionRef>(null);
  const [showPreview, setShowPreview] = useState(true);
  const { title, ContactInfo, ResumeSections } = resume ?? {};
  // CAREERFLOW: a resume is either structured (editable sections) or an uploaded
  // file (PDF/DOCX whose text AI features read). Surface which mode it's in so
  // the AI/section actions aren't confusing.
  const hasSections = (ResumeSections?.length ?? 0) > 0;
  const isUploadedFile = !hasSections && Boolean(resume?.FileId);
  const summarySection = ResumeSections?.find(
    (section) => section.sectionType === SectionType.SUMMARY,
  );
  const experienceSection = ResumeSections?.find(
    (section) => section.sectionType === SectionType.EXPERIENCE,
  );
  const educationSection = ResumeSections?.find(
    (section) => section.sectionType === SectionType.EDUCATION,
  );
  const certificationSection = ResumeSections?.find(
    (section) => section.sectionType === SectionType.CERTIFICATION,
  );
  const openContactInfoDialog = () => {
    resumeSectionRef.current?.openContactInfoDialog(ContactInfo!);
  };
  const openSummaryDialogForEdit = () => {
    resumeSectionRef.current?.openSummaryDialog(summarySection!);
  };
  const openExperienceDialogForEdit = (experienceId: string) => {
    const section: ResumeSection = {
      ...experienceSection!,
      workExperiences: experienceSection?.workExperiences?.filter(
        (exp) => exp.id === experienceId,
      ),
    };
    resumeSectionRef.current?.openExperienceDialog(section);
  };
  const openEducationDialogForEdit = (educationId: string) => {
    const section: ResumeSection = {
      ...educationSection!,
      educations: educationSection?.educations?.filter(
        (edu) => edu.id === educationId,
      ),
    };
    resumeSectionRef.current?.openEducationDialog(section);
  };
  const openCertificationDialogForEdit = (certificationId: string) => {
    const section: ResumeSection = {
      ...certificationSection!,
      licenseOrCertifications:
        certificationSection?.licenseOrCertifications?.filter(
          (cert) => cert.id === certificationId,
        ),
    };
    resumeSectionRef.current?.openCertificationDialog(section);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            Resume
            <Badge
              variant="secondary"
              className="font-normal"
              title={
                isUploadedFile
                  ? "AI reads the text extracted from your uploaded file. Add sections to make it editable, or to enable tailoring."
                  : hasSections
                    ? "Built from editable sections; supports AI review, match, and tailoring."
                    : "Empty — add sections or upload a file."
              }
            >
              {hasSections ? "Structured" : isUploadedFile ? "Uploaded file" : "Empty"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {resume.FileId && resume.File?.filePath
              ? DownloadFileButton(
                  resume.File?.filePath,
                  title,
                  resume.File?.fileName,
                )
              : title}
          </CardDescription>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {showPreview ? "Hide preview" : "Show preview"}
            </Button>
            <DownloadResumePdfButton resume={resume} />
            <AddResumeSection resume={resume} ref={resumeSectionRef} />
            <AiResumeReviewSection resume={resume} />
          </div>
        </CardHeader>
      </Card>
      {ContactInfo && (
        <ContactInfoCard
          contactInfo={ContactInfo}
          openDialog={openContactInfoDialog}
        />
      )}
      {summarySection && (
        <SummarySectionCard
          summarySection={summarySection}
          openDialogForEdit={openSummaryDialogForEdit}
        />
      )}
      {experienceSection && (
        <ExperienceCard
          experienceSection={experienceSection}
          openDialogForEdit={openExperienceDialogForEdit}
        />
      )}
      {educationSection && (
        <EducationCard
          educationSection={educationSection}
          openDialogForEdit={openEducationDialogForEdit}
        />
      )}
      {certificationSection && (
        <CertificationCard
          certificationSection={certificationSection}
          openDialogForEdit={openCertificationDialogForEdit}
        />
      )}
      {showPreview && <ResumePdfPreview resume={resume} />}
    </>
  );
}

export default ResumeContainer;
