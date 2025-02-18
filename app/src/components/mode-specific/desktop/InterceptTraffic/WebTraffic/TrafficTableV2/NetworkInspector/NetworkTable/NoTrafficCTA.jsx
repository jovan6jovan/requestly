import React, { useCallback, useEffect, useState } from "react";
import { DesktopOutlined } from "@ant-design/icons";
import { Col, Row, Space, Typography } from "antd";
import { RQButton } from "lib/design-system/components";
import Logger from "lib/logger";
import {
  trackAppConnectFailureEvent,
  trackAppConnectedEvent,
  trackAppDisconnectedEvent,
  trackConnectAppsClicked,
  trackSystemWideConnected,
} from "modules/analytics/events/desktopApp/apps";
import { useDispatch, useSelector } from "react-redux";
import { actions } from "store";
import { getAllFilters } from "store/features/desktop-traffic-table/selectors";
import { getDesktopSpecificDetails } from "store/selectors";
import { getConnectedAppsCount } from "utils/Misc";
import { toast } from "utils/Toast";

const NoTrafficCTA = () => {
  const dispatch = useDispatch();
  const { appsList } = useSelector(getDesktopSpecificDetails);
  const trafficTableFilters = useSelector(getAllFilters);
  const systemWideSource = appsList["system-wide"];

  const [numberOfConnectedApps, setNumberOfConnectedApps] = useState(0);

  useEffect(() => {
    setNumberOfConnectedApps(getConnectedAppsCount(Object.values(appsList)));
  }, [appsList, numberOfConnectedApps]);

  const openConnectedAppsModal = useCallback(
    (props = {}) => {
      dispatch(
        actions.toggleActiveModal({
          modalName: "connectedAppsModal",
          newValue: true,
          newProps: props,
        })
      );
      trackConnectAppsClicked("traffic_table");
    },
    [dispatch]
  );

  const connectSystemWide = useCallback(() => {
    if (!window.RQ || !window.RQ.DESKTOP) return;

    window.RQ.DESKTOP.SERVICES.IPC.invokeEventInBG("activate-app", {
      id: systemWideSource.id,
    })
      .then((res) => {
        if (res.success) {
          toast.success(`Connected ${systemWideSource.name}`);
          dispatch(
            actions.updateDesktopSpecificAppProperty({
              appId: systemWideSource.id,
              property: "isActive",
              value: true,
            })
          );
          trackAppConnectedEvent(systemWideSource.name);
          trackSystemWideConnected("traffic_table");
        } else {
          toast.error(`Unable to activate ${systemWideSource.name}. Issue reported.`);
          trackAppConnectFailureEvent(systemWideSource.name);
          openConnectedAppsModal({
            showInstructions: true,
            appId: "system-wide",
          });
        }
      })
      .catch(Logger.log);
  }, [dispatch, openConnectedAppsModal, systemWideSource.id, systemWideSource.name]);

  const disconnectSystemWide = useCallback(() => {
    if (!window.RQ || !window.RQ.DESKTOP) return;

    window.RQ.DESKTOP.SERVICES.IPC.invokeEventInBG("deactivate-app", {
      id: systemWideSource.id,
    })
      .then((res) => {
        // Notify user and update state
        if (res.success) {
          toast.info(`Disconnected ${systemWideSource.name}`);

          dispatch(
            actions.updateDesktopSpecificAppProperty({
              appId: systemWideSource.id,
              property: "isActive",
              value: false,
            })
          );
          trackAppDisconnectedEvent(systemWideSource.name);
        } else {
          toast.error(`Unable to deactivate ${systemWideSource.name}. Issue reported.`);
        }
      })
      .catch((err) => Logger.log(err));
  }, [dispatch, systemWideSource.id, systemWideSource.name]);

  const renderEmptyTablePlaceholder = useCallback(() => {
    if (!systemWideSource.isAvailable) {
      return null;
    }

    if (systemWideSource.isActive) {
      return (
        <>
          <Typography.Text>Requestly is enabled to inspect all traffic from this device.</Typography.Text>
          <RQButton type="default" className="danger-btn" onClick={disconnectSystemWide}>
            Disconnect
          </RQButton>
        </>
      );
    }

    if (numberOfConnectedApps > 0) {
      if (
        trafficTableFilters.search.term.length ||
        Object.values(trafficTableFilters).some((prop) => prop.length > 0)
      ) {
        return <Typography.Text>No request matches the filter you applied</Typography.Text>;
      }
      return (
        <>
          <Typography.Text>
            {numberOfConnectedApps} app connected. All the intercepted network logs will be displayed here.
          </Typography.Text>
          <RQButton type="primary" onClick={openConnectedAppsModal}>
            Connect Another App
          </RQButton>
        </>
      );
    }

    return (
      <>
        <Typography.Text>Connect apps to start intercepting traffic</Typography.Text>
        <RQButton type="primary" onClick={openConnectedAppsModal}>
          Connect apps
        </RQButton>
        <Typography.Text>Or</Typography.Text>
        <Typography.Text>Capture all the requests from this device</Typography.Text>
        <RQButton type="default" onClick={connectSystemWide} icon={<DesktopOutlined />}>
          Enable Requestly system-wide
        </RQButton>
      </>
    );
  }, [
    connectSystemWide,
    disconnectSystemWide,
    numberOfConnectedApps,
    openConnectedAppsModal,
    systemWideSource.isActive,
    systemWideSource.isAvailable,
    trafficTableFilters,
  ]);

  return (
    <Row className="empty-traffic-table-container" justify={"center"}>
      <Col>
        <Space direction="vertical" align="center">
          {renderEmptyTablePlaceholder()}
        </Space>
      </Col>
    </Row>
  );
};

export default NoTrafficCTA;
