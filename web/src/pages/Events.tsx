import ActivityIndicator from "@/components/indicators/activity-indicator";
import useApiFilter from "@/hooks/use-api-filter";
import { useCameraPreviews } from "@/hooks/use-camera-previews";
import { useTimezone } from "@/hooks/use-date-utils";
import { useOverlayState, useSearchEffect } from "@/hooks/use-overlay-state";
import { useUserPersistence } from "@/hooks/use-user-persistence";
import { FrigateConfig } from "@/types/frigateConfig";
import { RecordingStartingPoint } from "@/types/record";
import {
  RecordingsSummary,
  REVIEW_PADDING,
  ReviewFilter,
  ReviewSegment,
  ReviewSeverity,
  ReviewSummary,
  SegmentedReviewData,
} from "@/types/review";
import { TimelineType } from "@/types/timeline";
import {
  getBeginningOfDayTimestamp,
  getEndOfDayTimestamp,
} from "@/utils/dateUtil";
import EventView from "@/views/events/EventView";
import { RecordingView } from "@/views/recording/RecordingView";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useAllowedCameras } from "@/hooks/use-allowed-cameras";

const HISTORY_CAMERA_LIMIT = 4;

export default function Events() {
  const { t } = useTranslation(["views/events"]);

  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });
  const allowedCameras = useAllowedCameras();
  const timezone = useTimezone(config);

  // recordings viewer

  const [severity, setSeverity] = useOverlayState<ReviewSeverity>(
    "severity",
    "alert",
  );

  const [showReviewed, setShowReviewed] = useUserPersistence(
    "showReviewed",
    false,
  );

  const [recording, setRecording] = useOverlayState<RecordingStartingPoint>(
    "recording",
    undefined,
    false,
  );

  const [notificationTab, setNotificationTab] =
    useState<TimelineType>("timeline");

  useSearchEffect("tab", (tab: string) => {
    if (tab === "timeline" || tab === "events" || tab === "detail") {
      setNotificationTab(tab as TimelineType);
    }
    return true;
  });

  useSearchEffect("id", (reviewId: string) => {
    axios
      .get(`review/${reviewId}`)
      .then((resp) => {
        if (resp.status == 200 && resp.data) {
          const startTime = resp.data.start_time - REVIEW_PADDING;
          const date = new Date(startTime * 1000);

          setReviewFilter({
            after: getBeginningOfDayTimestamp(date),
            before: getEndOfDayTimestamp(date),
          });
          setRecording(
            {
              camera: resp.data.camera,
              startTime,
              severity: resp.data.severity,
              timelineType: notificationTab,
            },
            true,
          );
        }
      })
      .catch(() => {});

    return true;
  });

  const [startTime, setStartTime] = useState<number>();

  useEffect(() => {
    if (recording) {
      document.title = t("recordings.documentTitle");
    } else {
      document.title = t("documentTitle");
    }
  }, [recording, severity, t]);

  // review filter

  const [reviewFilter, setReviewFilter, reviewSearchParams] =
    useApiFilter<ReviewFilter>();

  useSearchEffect("cameras", (cameras: string) => {
    setReviewFilter({
      ...reviewFilter,
      cameras: (cameras.includes(",") ? cameras.split(",") : [cameras]).slice(
        0,
        HISTORY_CAMERA_LIMIT,
      ),
    });
    return true;
  });

  useSearchEffect("labels", (labels: string) => {
    setReviewFilter({
      ...reviewFilter,
      labels: labels.includes(",") ? labels.split(",") : [labels],
    });
    return true;
  });

  useSearchEffect("zones", (zones: string) => {
    setReviewFilter({
      ...reviewFilter,
      zones: zones.includes(",") ? zones.split(",") : [zones],
    });
    return true;
  });

  useSearchEffect("group", (reviewGroup) => {
    if (config && reviewGroup && reviewGroup != "default") {
      const group = config.camera_groups[reviewGroup];
      const isBirdseyeOnly =
        group.cameras.length == 1 && group.cameras[0] == "birdseye";

      if (group && !isBirdseyeOnly) {
        setReviewFilter({
          ...reviewFilter,
          cameras: group.cameras.slice(0, HISTORY_CAMERA_LIMIT),
        });
      }

      return true;
    }

    return false;
  });

  const onUpdateFilter = useCallback(
    (newFilter: ReviewFilter) => {
      const limitedFilter = {
        ...newFilter,
        cameras: newFilter.cameras?.slice(0, HISTORY_CAMERA_LIMIT),
      };

      setReviewFilter(limitedFilter);

      // update recording start time if filter
      // was changed on recording page
      if (recording != undefined && limitedFilter.after != undefined) {
        setRecording({ ...recording, startTime: limitedFilter.after }, true);
      }
    },
    [recording, setRecording, setReviewFilter],
  );

  const defaultHistoryCameras = useMemo(
    () =>
      allowedCameras
        .filter((camera) => camera !== "birdseye")
        .sort(
          (a, b) =>
            (config?.cameras[a]?.ui?.order ?? 0) -
            (config?.cameras[b]?.ui?.order ?? 0),
        )
        .slice(0, HISTORY_CAMERA_LIMIT),
    [allowedCameras, config],
  );

  const [beforeTs, setBeforeTs] = useState(Math.ceil(Date.now() / 1000));
  const defaultTimeRange = useMemo(() => {
    const today = new Date(beforeTs * 1000);
    return {
      before: getEndOfDayTimestamp(today),
      after: getBeginningOfDayTimestamp(today),
    };
  }, [beforeTs]);

  const effectiveReviewFilter = useMemo<ReviewFilter>(
    () => ({
      ...reviewFilter,
      cameras: reviewFilter?.cameras ?? defaultHistoryCameras,
      after: reviewFilter?.after ?? defaultTimeRange.after,
      before: reviewFilter?.before ?? defaultTimeRange.before,
    }),
    [defaultHistoryCameras, defaultTimeRange, reviewFilter],
  );

  useEffect(() => {
    if (!config || defaultHistoryCameras.length === 0) {
      return;
    }

    if (
      reviewFilter?.cameras == undefined ||
      reviewFilter.cameras.length > HISTORY_CAMERA_LIMIT
    ) {
      setReviewFilter({
        ...reviewFilter,
        cameras: (reviewFilter?.cameras ?? defaultHistoryCameras).slice(
          0,
          HISTORY_CAMERA_LIMIT,
        ),
      });
    }
  }, [config, defaultHistoryCameras, reviewFilter, setReviewFilter]);

  // review paging

  const selectedTimeRange = useMemo(() => {
    if (reviewSearchParams["after"] == undefined) {
      return defaultTimeRange;
    }

    return {
      before: Math.ceil(reviewSearchParams["before"]),
      after: Math.floor(reviewSearchParams["after"]),
    };
  }, [defaultTimeRange, reviewSearchParams]);

  // we want to update the items whenever the severity changes
  useEffect(() => {
    if (recording) {
      return;
    }

    const now = Date.now() / 1000;

    if (now - beforeTs > 60) {
      setBeforeTs(now);
    }

    // only refresh when severity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity]);

  const reviewSegmentFetcher = useCallback((key: Array<string> | string) => {
    const [path, params] = Array.isArray(key) ? key : [key, undefined];
    return axios.get(path, { params }).then((res) => res.data);
  }, []);

  const getKey = useCallback(() => {
    const params = {
      cameras:
        reviewSearchParams["cameras"] ??
        effectiveReviewFilter.cameras?.join(","),
      labels: reviewSearchParams["labels"],
      zones: reviewSearchParams["zones"],
      reviewed: null, // We want both reviewed and unreviewed items as we filter in the UI
      before: reviewSearchParams["before"] || effectiveReviewFilter.before,
      after: reviewSearchParams["after"] || effectiveReviewFilter.after,
    };
    return ["review", params];
  }, [reviewSearchParams, effectiveReviewFilter]);

  const { data: reviews, mutate: updateSegments } = useSWR<ReviewSegment[]>(
    getKey,
    reviewSegmentFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const reviewItems = useMemo<SegmentedReviewData>(() => {
    if (!reviews) {
      return undefined;
    }

    const all: ReviewSegment[] = [];
    const alerts: ReviewSegment[] = [];
    const detections: ReviewSegment[] = [];
    const motion: ReviewSegment[] = [];

    reviews?.forEach((segment) => {
      all.push(segment);

      switch (segment.severity) {
        case "alert":
          alerts.push(segment);
          break;
        case "detection":
          detections.push(segment);
          break;
        default:
          motion.push(segment);
          break;
      }
    });

    return {
      all: all,
      alert: alerts,
      detection: detections,
      significant_motion: motion,
    };
  }, [reviews]);

  const currentItems = useMemo(() => {
    if (!reviewItems || !severity) {
      return null;
    }

    let current;

    if (reviewFilter?.showAll) {
      current = reviewItems.all;
    } else {
      current = reviewItems[severity];
    }

    if (!current || current.length == 0) {
      return [];
    }

    if (!showReviewed) {
      return current.filter((seg) => !seg.has_been_reviewed);
    } else {
      return current;
    }
    // only refresh when severity or filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, reviewFilter, showReviewed, reviewItems?.all.length]);

  // review summary

  const { data: reviewSummary, mutate: updateSummary } = useSWR<ReviewSummary>(
    [
      "review/summary",
      {
        timezone: timezone,
        cameras:
          reviewSearchParams["cameras"] ??
          effectiveReviewFilter.cameras?.join(",") ??
          null,
        labels: reviewSearchParams["labels"] ?? null,
        zones: reviewSearchParams["zones"] ?? null,
      },
    ],
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
      revalidateOnReconnect: false,
    },
  );

  const reloadData = useCallback(() => {
    setBeforeTs(Date.now() / 1000);
    updateSummary();
  }, [updateSummary]);

  // recordings summary

  const { data: recordingsSummary } = useSWR<RecordingsSummary>([
    "recordings/summary",
    {
      timezone: timezone,
      cameras:
        reviewSearchParams["cameras"] ??
        effectiveReviewFilter.cameras?.join(",") ??
        null,
    },
  ]);

  // preview videos
  const previewTimes = useMemo(() => {
    const startDate = new Date(selectedTimeRange.after * 1000);
    startDate.setUTCMinutes(0, 0, 0);

    const endDate = new Date(selectedTimeRange.before * 1000);
    endDate.setHours(endDate.getHours() + 1, 0, 0, 0);

    return {
      after: startDate.getTime() / 1000,
      before: endDate.getTime() / 1000,
    };
  }, [selectedTimeRange]);

  const allPreviews = useCameraPreviews(
    previewTimes ?? { after: 0, before: 0 },
    {
      fetchPreviews: previewTimes != undefined,
    },
  );

  // review status

  const markAllItemsAsReviewed = useCallback(
    async (currentItems: ReviewSegment[]) => {
      if (currentItems.length == 0) {
        return;
      }

      const severity = currentItems[0].severity;
      updateSegments(
        (data: ReviewSegment[] | undefined) => {
          if (!data) {
            return data;
          }

          const newData = [...data];

          newData.forEach((seg) => {
            if (seg.end_time && seg.severity == severity) {
              seg.has_been_reviewed = true;
            }
          });

          return newData;
        },
        { revalidate: false, populateCache: true },
      );

      const itemsToMarkReviewed = currentItems
        ?.filter((seg) => seg.end_time)
        ?.map((seg) => seg.id);

      if (itemsToMarkReviewed.length > 0) {
        await axios.post(`reviews/viewed`, {
          ids: itemsToMarkReviewed,
          reviewed: true,
        });
        reloadData();

        if (reviewSearchParams["after"] != undefined) {
          updateSegments();
        }
      }
    },
    [reloadData, updateSegments, reviewSearchParams],
  );

  const markItemAsReviewed = useCallback(
    async (review: ReviewSegment) => {
      const resp = await axios.post(`reviews/viewed`, {
        ids: [review.id],
        reviewed: true,
      });

      if (resp.status == 200) {
        updateSegments(
          (data: ReviewSegment[] | undefined) => {
            if (!data) {
              return data;
            }

            const reviewIndex = data.findIndex((item) => item.id == review.id);
            if (reviewIndex == -1) {
              return data;
            }

            const newData = [
              ...data.slice(0, reviewIndex),
              { ...data[reviewIndex], has_been_reviewed: true },
              ...data.slice(reviewIndex + 1),
            ];

            return newData;
          },
          { revalidate: false, populateCache: true },
        );

        updateSummary(
          (data: ReviewSummary | undefined) => {
            if (!data) {
              return data;
            }

            const day = new Date(review.start_time * 1000);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let key;
            if (day.getTime() > today.getTime()) {
              key = "last24Hours";
            } else {
              key = `${day.getFullYear()}-${("0" + (day.getMonth() + 1)).slice(-2)}-${("0" + day.getDate()).slice(-2)}`;
            }

            if (!Object.keys(data).includes(key)) {
              return data;
            }

            const item = data[key];
            return {
              ...data,
              [key]: {
                ...item,
                reviewed_alert:
                  review.severity == "alert"
                    ? item.reviewed_alert + 1
                    : item.reviewed_alert,
                reviewed_detection:
                  review.severity == "detection"
                    ? item.reviewed_detection + 1
                    : item.reviewed_detection,
              },
            };
          },
          { revalidate: false, populateCache: true },
        );
      }
    },
    [updateSegments, updateSummary],
  );

  // selected items

  const selectedReviewData = useMemo(() => {
    if (!recording) {
      return undefined;
    }

    if (!config) {
      return undefined;
    }

    if (!reviews) {
      return undefined;
    }

    setStartTime(recording.startTime);
    const allCameras =
      effectiveReviewFilter.cameras ?? Object.keys(config.cameras);

    return {
      camera: recording.camera,
      start_time: recording.startTime,
      allCameras: allCameras,
    };

    // previews will not update after item is selected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveReviewFilter.cameras, recording, reviews]);

  if (!timezone) {
    return <ActivityIndicator />;
  }

  if (recording) {
    if (selectedReviewData) {
      return (
        <RecordingView
          key={selectedTimeRange.before}
          startCamera={selectedReviewData.camera}
          startTime={selectedReviewData.start_time}
          allCameras={selectedReviewData.allCameras}
          reviewItems={reviews}
          reviewSummary={reviewSummary}
          allPreviews={allPreviews}
          timeRange={selectedTimeRange}
          filter={effectiveReviewFilter}
          updateFilter={onUpdateFilter}
          refreshData={reloadData}
        />
      );
    }
  } else {
    return (
      <EventView
        reviewItems={reviewItems}
        currentReviewItems={currentItems}
        reviewSummary={reviewSummary}
        recordingsSummary={recordingsSummary}
        relevantPreviews={allPreviews}
        timeRange={selectedTimeRange}
        filter={effectiveReviewFilter}
        severity={severity ?? "alert"}
        startTime={startTime}
        showReviewed={showReviewed ?? false}
        setShowReviewed={setShowReviewed}
        setSeverity={setSeverity}
        markItemAsReviewed={markItemAsReviewed}
        markAllItemsAsReviewed={markAllItemsAsReviewed}
        onOpenRecording={setRecording}
        pullLatestData={reloadData}
        updateFilter={onUpdateFilter}
      />
    );
  }
}
